import stripe, random, csv, io, base64
import pandas as pd
import matplotlib
import calendar
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.tree import DecisionTreeClassifier, plot_tree
from datetime import timedelta, datetime
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Q, Sum, Count
from django.db.models.functions import TruncDay
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.mail import send_mail
from django.http import HttpResponse
from mlxtend.frequent_patterns import apriori, association_rules

# Swagger Imports
from drf_spectacular.utils import extend_schema, OpenApiTypes, OpenApiParameter

from .models import Garage, Equipment, Reservation, Payment, SystemConfig
from .serializers import GarageSerializer, EquipmentSerializer, ReservationSerializer, PaymentSerializer, SystemConfigSerializer

try:
    from backend.permissions import IsSystemAdmin
except ImportError:
    from rest_framework.permissions import IsAdminUser as IsSystemAdmin

stripe.api_key = settings.STRIPE_SECRET_KEY

# --- FUNKCJE POMOCNICZE ---

def clean_expired_reservations():
    expiration_threshold = timezone.now() - timedelta(minutes=15)
    expired = Reservation.objects.filter(status='pending', created_at__lt=expiration_threshold)
    expired.update(status='cancelled')

def prepare_ml_dataframe(df):
    """
    Wspólna funkcja przetwarzająca dane do formatu zrozumiałego dla algorytmu Apriori.
    Ujednolica logikę dla danych z pliku i danych z bazy.
    """
    required_analytics_cols = ['Long_4h', 'Weekend']
    has_analytics_format = all(col in df.columns for col in required_analytics_cols)

    ml_data = []

    if has_analytics_format:
        try:
            start_idx = df.columns.get_loc('Weekend') + 1
            if 'Status' in df.columns:
                end_idx = df.columns.get_loc('Status')
            else:
                end_idx = len(df.columns)
            equipment_cols = df.columns[start_idx:end_idx].tolist()
        except:
            equipment_cols = []

        for _, row in df.iterrows():
            data_row = {
                'Reservation over 4h': str(row['Long_4h']).strip().upper() == 'YES',
                'Weekend reservation': str(row['Weekend']).strip().upper() == 'YES'
            }
            for eq_col in equipment_cols:
                data_row[eq_col] = str(row[eq_col]).strip().upper() == 'YES'
            ml_data.append(data_row)

    else:
        required_raw_cols = ['Garage Name', 'Start Date', 'End Date', 'Status']
        if not all(col in df.columns for col in required_raw_cols):
            return pd.DataFrame()

        valid_statuses = ['confirmed', 'completed']
        df = df[df['Status'].str.lower().str.strip().isin(valid_statuses)]

        if df.empty:
            return pd.DataFrame()

        df['start'] = pd.to_datetime(df['Start Date'], format='%Y-%m-%d %H:%M')
        df['end'] = pd.to_datetime(df['End Date'], format='%Y-%m-%d %H:%M')

        all_garages = Garage.objects.all().prefetch_related('equipment')
        garage_equipment_map = {g.name.strip().lower(): list(g.equipment.values_list('name', flat=True)) for g in all_garages}
        all_eq_names = sorted(list(set(name for sublist in garage_equipment_map.values() for name in sublist)))

        for _, row in df.iterrows():
            duration = (row['end'] - row['start']).total_seconds() / 3600
            is_weekend = row['start'].weekday() >= 5
            g_name = str(row['Garage Name']).strip().lower()
            
            data_row = {
                'Reservation over 4h': duration > 4,
                'Weekend reservation': is_weekend
            }
            
            current_eq = garage_equipment_map.get(g_name, [])
            for eq_name in all_eq_names:
                data_row[eq_name] = eq_name in current_eq
            
            ml_data.append(data_row)

    return pd.DataFrame(ml_data)

def generate_csv_data_for_ml(reservations):
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    
    all_equipment = list(Equipment.objects.all().order_by('id'))
    eq_names = [e.name for e in all_equipment]
    
    header = ['Reservation_ID', 'Duration_h', 'Long_4h', 'Weekend'] + eq_names + ['Status']
    writer.writerow(header)

    for res in reservations:
        duration = (res.end_time - res.start_time).total_seconds() / 3600
        is_weekend = res.start_time.weekday() >= 5
        garage_eq_ids = set(res.garage.equipment.values_list('id', flat=True))
        
        row = [
            res.id,
            str(round(duration, 1)).replace('.', ','),
            "YES" if duration > 4 else "NO",
            "YES" if is_weekend else "NO"
        ]
        
        for eq in all_equipment:
            row.append("YES" if eq.id in garage_eq_ids else "NO")
            
        row.append(res.get_status_display())
        writer.writerow(row)
        
    return output.getvalue()

# --- WIDOKI API ---

class GarageViewSet(viewsets.ModelViewSet):
    queryset = Garage.objects.all()
    serializer_class = GarageSerializer
    
    filter_backends = [filters.SearchFilter]
    search_fields = ['name__unaccent', 'address__unaccent', 'equipment__name__unaccent']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'check_availability', 'check_month_availability']:
            return [AllowAny()]
        elif self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSystemAdmin()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'])
    def check_availability(self, request, pk=None):
        garage = self.get_object()
        date_str = request.query_params.get('date')

        if not date_str:
            return Response({'error': 'Missing date parameter'}, status=400)

        try:
            query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Expected YYYY-MM-DD'}, status=400)

        day_start = timezone.make_aware(datetime.combine(query_date, datetime.min.time()))
        day_end = day_start + timedelta(days=1)

        reservations = Reservation.objects.filter(
            garage=garage,
            status__in=['confirmed', 'pending'],
            start_time__lt=day_end,
            end_time__gt=day_start
        )

        busy_hours = []

        for hour in range(24):
            slot_start = day_start + timedelta(hours=hour)
            slot_end = slot_start + timedelta(hours=1)

            for res in reservations:
                if res.start_time < slot_end and res.end_time > slot_start:
                    busy_hours.append(hour)
                    break 

        return Response({'date': date_str, 'busy_hours': busy_hours})

    @action(detail=True, methods=['get'])
    def check_month_availability(self, request, pk=None):
        garage = self.get_object()
        try:
            year = int(request.query_params.get('year'))
            month = int(request.query_params.get('month'))
        except (TypeError, ValueError):
            return Response({'error': 'Required parameters: year and month (numbers)'}, status=400)

        num_days = calendar.monthrange(year, month)[1]
        month_start = timezone.make_aware(datetime(year, month, 1))
        
        if month == 12:
            month_end = timezone.make_aware(datetime(year + 1, 1, 1))
        else:
            month_end = timezone.make_aware(datetime(year, month + 1, 1))

        reservations = Reservation.objects.filter(
            garage=garage,
            status__in=['confirmed', 'pending'],
            start_time__lt=month_end,
            end_time__gt=month_start
        )

        availability_map = {}

        for day in range(1, num_days + 1):
            day_date = datetime(year, month, day).date()
            date_str = day_date.strftime('%Y-%m-%d')
            day_start = timezone.make_aware(datetime.combine(day_date, datetime.min.time()))
            
            occupied_hours = 0
            
            for hour in range(24):
                slot_start = day_start + timedelta(hours=hour)
                slot_end = slot_start + timedelta(hours=1)
                is_busy = False
                for res in reservations:
                    if res.start_time < slot_end and res.end_time > slot_start:
                        is_busy = True
                        break
                if is_busy:
                    occupied_hours += 1

            if occupied_hours == 24:
                status_val = 'full'
            elif occupied_hours > 0:
                status_val = 'partial'
            else:
                status_val = 'free'

            availability_map[date_str] = status_val

        return Response(availability_map)


class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    
    def get_permissions(self):
        if self.action == 'list':
            return [IsAuthenticated()]
        return [IsSystemAdmin()]

class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    
    def get_queryset(self):
        clean_expired_reservations()
        
        user = self.request.user
        if user.is_anonymous:
            return Reservation.objects.none()
        if hasattr(user, 'role') and user.role == 'admin':
            return Reservation.objects.all()
        return Reservation.objects.filter(user=user)

    def perform_create(self, serializer):
        code = str(random.randint(100000, 999999))
        serializer.save(user=self.request.user, access_code=code)

    @action(detail=False, methods=['get'])
    def active_notifications(self, request):
        if request.user.is_anonymous:
            return Response([])
        
        notifs = Reservation.objects.filter(
            user=request.user,
            status='cancelled',
            cancellation_seen=False
        ).exclude(cancellation_reason__isnull=True).exclude(cancellation_reason__exact='')
        
        serializer = self.get_serializer(notifs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_seen(self, request, pk=None):
        reservation = self.get_object()
        if reservation.user != request.user:
            return Response({'error': 'Permission denied'}, status=403)
        
        reservation.cancellation_seen = True
        reservation.save()
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'])
    def emergency_cancel(self, request, pk=None):
        reservation = self.get_object()
        
        if reservation.user != request.user and not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get('reason', '') if request.user.is_staff else None

        now = timezone.now()
        time_until_start = reservation.start_time - now
        
        refund_message = "No refund (less than 24 hours before start)."
        refunded = False

        if time_until_start > timedelta(hours=24):
            payments = reservation.payments.all()
            if not payments:
                refund_message = "No payments found to refund."
            else:
                refund_errors = []
                success_count = 0
                for payment in payments:
                    if not payment.is_refunded and payment.stripe_charge_id:
                        try:
                            stripe.Refund.create(payment_intent=payment.stripe_charge_id)
                            payment.is_refunded = True
                            payment.save()
                            success_count += 1
                        except stripe.error.StripeError as e:
                            print(f"Stripe Refund Error: {e}")
                            refund_errors.append(str(e))
                
                if success_count > 0:
                    refunded = True
                    refund_message = f"Refund requested ({success_count} transactions)."
                elif refund_errors:
                    refund_message = "Error while refunding part of the funds."
                else:
                    refund_message = "Funds have already been refunded earlier."

        reservation.status = 'cancelled'
        if reason:
            reservation.cancellation_reason = reason
            reservation.cancellation_seen = False
            
        reservation.save()

        return Response({
            'status': 'cancelled',
            'refunded': refunded,
            'message': refund_message
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def mark_overstay(self, request, pk=None):
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        reservation = self.get_object()
        is_overstay = request.data.get('overstayed', True)
        reservation.overstayed = is_overstay
        reservation.save()
        
        msg = "User blocked (Overstay)" if is_overstay else "User unblocked"
        return Response({'status': 'updated', 'overstayed': reservation.overstayed, 'message': msg})

    @action(detail=True, methods=['post'])
    def initiate_extension(self, request, pk=None):
        reservation = self.get_object()
        new_end_time_str = request.data.get('new_end_time')

        if not new_end_time_str:
            return Response({'error': 'Required parameter: new_end_time'}, status=400)

        try:
            if new_end_time_str.endswith('Z'):
                new_end_time_str = new_end_time_str.replace('Z', '+00:00')
            new_end_time = datetime.fromisoformat(new_end_time_str)
        except ValueError:
            return Response({'error': 'Invalid ISO date format'}, status=400)

        if new_end_time <= reservation.end_time:
            return Response({'error': 'New date must be later than the current one'}, status=400)

        conflicting_reservations = Reservation.objects.filter(
            garage=reservation.garage,
            status__in=['confirmed', 'pending'],
            start_time__lt=new_end_time,
            end_time__gt=reservation.end_time
        ).exclude(id=reservation.id)

        if conflicting_reservations.exists():
            return Response({'error': 'Selected time range conflicts with another reservation.'}, status=409)

        duration_diff = new_end_time - reservation.end_time
        additional_hours = duration_diff.total_seconds() / 3600
        additional_cost = round(additional_hours * float(reservation.garage.price_per_hour), 2)

        if additional_cost <= 0:
             return Response({'error': 'Extension amount is 0.'}, status=400)

        try:
            intent = stripe.PaymentIntent.create(
                amount=int(additional_cost * 100),
                currency='pln',
                metadata={
                    'reservation_id': reservation.id,
                    'type': 'extension',
                    'new_end_time': new_end_time_str
                },
                automatic_payment_methods={'enabled': True},
            )
            
            return Response({
                'clientSecret': intent.client_secret,
                'additional_cost': additional_cost,
                'new_end_time': new_end_time_str,
                'paymentIntentId': intent.id
            })

        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=True, methods=['post'])
    def confirm_extension(self, request, pk=None):
        reservation = self.get_object()
        payment_intent_id = request.data.get('payment_intent_id')
        new_end_time_str = request.data.get('new_end_time')
        additional_cost = request.data.get('additional_cost')

        if not payment_intent_id or not new_end_time_str:
            return Response({'error': 'Missing data'}, status=400)

        try:
            if Payment.objects.filter(stripe_charge_id=payment_intent_id).exists():
                return Response({'status': 'exists', 'message': 'Payment already registered'})

            if new_end_time_str.endswith('Z'):
                new_end_time_str = new_end_time_str.replace('Z', '+00:00')
            
            reservation.end_time = datetime.fromisoformat(new_end_time_str)
            reservation.total_price = float(reservation.total_price) + float(additional_cost)
            reservation.save()

            Payment.objects.create(
                reservation=reservation,
                stripe_charge_id=payment_intent_id,
                amount=additional_cost,
                is_refunded=False
            )

            return Response({'status': 'extended', 'new_end_time': reservation.end_time})
        
        except Exception as e:
            return Response({'error': f"Server error: {str(e)}"}, status=500)

@extend_schema(
    summary="Stripe payment initialization",
    description="Creates a PaymentIntent for the given reservation. Returns clientSecret required by Stripe.js.",
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_payment_intent(request, reservation_id):
    reservation = get_object_or_404(Reservation, id=reservation_id)
    
    if reservation.user != request.user:
        return Response({'error': 'This is not your reservation'}, status=403)

    if reservation.status == 'pending':
        deadline = reservation.created_at + timedelta(minutes=15)
        if timezone.now() > deadline:
            reservation.status = 'cancelled'
            reservation.save()
            return Response({'error': 'Reservation payment time has expired (15 min). Reservation has been canceled.'}, status=400)

    try:
        intent = stripe.PaymentIntent.create(
            amount=int(reservation.total_price * 100),
            currency='pln',
            metadata={'reservation_id': reservation.id},
            automatic_payment_methods={'enabled': True},
        )
        return Response({
            'clientSecret': intent.client_secret,
            'paymentIntentId': intent.id 
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@extend_schema(
    summary="Save payment confirmation",
    description="Finalizes reservation after successful Stripe payment and sends email with access code.",
    responses={200: OpenApiTypes.OBJECT}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_payment_success(request):
    reservation_id = request.data.get('reservation_id')
    payment_intent_id = request.data.get('payment_intent_id')
    
    reservation = get_object_or_404(Reservation, id=reservation_id)

    if Payment.objects.filter(stripe_charge_id=payment_intent_id).exists():
        reservation.status = 'confirmed'
        reservation.save()
        return Response({'status': 'confirmed', 'message': 'Payment already exists'})

    Payment.objects.create(
        reservation=reservation,
        stripe_charge_id=payment_intent_id, 
        amount=reservation.total_price,
        is_refunded=False
    )
    
    reservation.status = 'confirmed'
    reservation.save()

    subject = f"Reservation confirmation: {reservation.garage.name}"
    message = f"""
    Hello {request.user.username}!
    Your payment for garage {reservation.garage.name} has been approved.
    Date: {reservation.start_time.strftime('%Y-%m-%d %H:%M')}
    
    YOUR GATE ACCESS CODE: {reservation.access_code}
    
    Garage address: {reservation.garage.address}
    
    Thank you!
    """
    
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [request.user.email])
    except Exception as e:
                print(f"Email sending error: {e}")

    return Response({'status': 'confirmed', 'access_code': reservation.access_code})

@extend_schema(
    summary="Import historii rezerwacji z CSV",
    description="Wgrywa plik CSV z historycznymi rezerwacjami.",
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {'type': 'string', 'format': 'binary'}
            }
        }
    },
    responses={200: OpenApiTypes.OBJECT}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def import_historical_csv(request):
    if getattr(request.user, 'role', '') != 'admin':
        return Response({"error": "Administrator permission required."}, status=403)

    if 'file' not in request.FILES:
        return Response({"error": "No file was uploaded."}, status=400)

    file = request.FILES['file']
    try:
        decoded_file = file.read().decode('utf-8')
        io_string = io.StringIO(decoded_file)
        reader = csv.reader(io_string, delimiter=';') 
    except Exception as e:
        return Response({"error": f"File read error: {str(e)}"}, status=400)

    next(reader, None) 

    created_count = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            if len(row) < 5: continue
            
            garage_name = row[0].strip()
            start_str = row[1].strip()
            end_str = row[2].strip()
            price_str = row[3].strip().replace(',', '.') 
            status_val = row[4].strip().lower()

            status_map = {
                'confirmed': 'confirmed',
                'pending': 'pending',
                'cancelled': 'cancelled',
                'completed': 'completed'
            }
            final_status = status_map.get(status_val, 'confirmed')

            garage = Garage.objects.filter(name__icontains=garage_name).first()
            if not garage:
                errors.append(f"Row {i+2}: Garage named '{garage_name}' was not found")
                continue

            try:
                start_dt = datetime.strptime(start_str, '%Y-%m-%d %H:%M')
                end_dt = datetime.strptime(end_str, '%Y-%m-%d %H:%M')
            except ValueError:
                errors.append(f"Row {i+2}: Invalid date format (expected YYYY-MM-DD HH:MM)")
                continue
            
            start_dt = timezone.make_aware(start_dt)
            end_dt = timezone.make_aware(end_dt)

            Reservation.objects.create(
                user=None, 
                garage=garage,
                start_time=start_dt,
                end_time=end_dt,
                total_price=float(price_str),
                status=final_status,
                is_historical=True, 
                access_code="IMPORT_CSV"
            )
            created_count += 1

        except Exception as e:
            errors.append(f"Row {i+2}: Critical error - {str(e)}")

    return Response({
        "message": f"Successfully imported {created_count} reservations.",
        "errors": errors
    }, status=200 if created_count > 0 else 400)

@extend_schema(
    summary="CSV analytics simulation",
    description="Processes CSV in RAM without saving it to the database (Sandbox).",
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {'type': 'string', 'format': 'binary'}
            }
        }
    },
    responses={200: OpenApiTypes.OBJECT}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def simulate_analytics_csv(request):
    if getattr(request.user, 'role', '') != 'admin':
        return Response({"error": "Permission denied."}, status=403)

    if 'file' not in request.FILES:
        return Response({"error": "No file was uploaded."}, status=400)

    try:
        file = request.FILES['file']
        decoded_file = file.read().decode('utf-8')
        io_string = io.StringIO(decoded_file)
        
        df = pd.read_csv(io_string, delimiter=';')
        
        required_cols = ['Garage Name', 'Start Date', 'End Date', 'Price', 'Status']
        if not all(col in df.columns for col in required_cols):
            return Response({"error": f"Invalid file format. Required columns: {', '.join(required_cols)}"}, status=400)

        df['start'] = pd.to_datetime(df['Start Date'], format='%Y-%m-%d %H:%M')
        df['end'] = pd.to_datetime(df['End Date'], format='%Y-%m-%d %H:%M')
        
        df['price'] = df['Price'].astype(str).str.replace(',', '.').astype(float)
        
        valid_statuses = ['confirmed', 'completed']
        df = df[df['Status'].str.lower().isin(valid_statuses)]

        if df.empty:
            return Response({"error": "The file does not contain reservations with status Confirmed/Completed."}, status=400)

        revenue_series = df.groupby(df['start'].dt.date)['price'].sum()
        revenue_data = {
            'labels': [date.strftime('%Y-%m-%d') for date in revenue_series.index],
            'data': revenue_series.values.tolist()
        }

        popularity_series = df['Garage Name'].value_counts().head(10)
        popularity_data = {
            'labels': popularity_series.index.tolist(),
            'data': popularity_series.values.tolist()
        }

        heatmap_matrix = [[0 for _ in range(24)] for _ in range(7)]
        
        for _, row in df.iterrows():
            current = row['start']
            end_time = row['end']
            while current < end_time:
                day_idx = current.weekday()
                hour_idx = current.hour
                heatmap_matrix[day_idx][hour_idx] += 1
                current += timedelta(hours=1)

        return Response({
            'message': 'File processed successfully (Simulation Mode)',
            'revenue': revenue_data,
            'popularity': popularity_data,
            'heatmap': heatmap_matrix
        })

    except Exception as e:
        return Response({"error": f"File processing error: {str(e)}"}, status=400)

@extend_schema(
    summary="Association rules analysis (Apriori)",
    description="GET: analyzes database data. POST: analyzes uploaded CSV file.",
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {'type': 'string', 'format': 'binary'}
            }
        }
    },
    parameters=[
        OpenApiParameter(name='start_date', description='Filter from date (YYYY-MM-DD)', required=False, type=str),
        OpenApiParameter(name='end_date', description='Filter to date (YYYY-MM-DD)', required=False, type=str),
    ],
    responses={200: OpenApiTypes.OBJECT}
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def get_ml_rules(request):
    if getattr(request.user, 'role', '') != 'admin':
        return Response({"error": "Permission denied."}, status=403)

    try:
        if request.method == 'POST':
            if 'file' not in request.FILES:
                return Response({"error": "No file was uploaded."}, status=400)
            
            file = request.FILES['file']
            decoded_file = file.read().decode('utf-8')
            
            first_line = decoded_file.split('\n')[0]
            delimiter = ';' if ';' in first_line else ','
            
            io_string = io.StringIO(decoded_file)
            df_raw = pd.read_csv(io_string, delimiter=delimiter)
            
            ml_df = prepare_ml_dataframe(df_raw)
            is_simulation = True

        else:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')

            reservations = Reservation.objects.filter(status__in=['confirmed', 'completed']).select_related('garage').prefetch_related('garage__equipment')
            
            if start_date:
                reservations = reservations.filter(start_time__date__gte=start_date)
            if end_date:
                reservations = reservations.filter(end_time__date__lte=end_date)

            if reservations.count() < 5:
                return Response({"message": "Too few reservations for ML analysis (minimum 5 required)."}, status=200)

            csv_content = generate_csv_data_for_ml(reservations)
            df_raw = pd.read_csv(io.StringIO(csv_content), delimiter=';')
            
            ml_df = prepare_ml_dataframe(df_raw)
            is_simulation = False

        if ml_df.empty or len(ml_df) < 5:
            return Response({
                "message": "Too little data after processing (or no data meeting criteria).",
                "is_simulation": is_simulation
            }, status=200)

        frequent_itemsets = apriori(ml_df, min_support=0.01, use_colnames=True)
        
        if frequent_itemsets.empty:
            return Response({
                "message": "No significant patterns found in data.",
                "is_simulation": is_simulation
            }, status=200)

        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=0.2)
        rules = rules[rules['lift'] > 1.05]
        
        if rules.empty:
            return Response({
                "message": "No rules meeting minimum criteria (lift > 1.05).",
                "is_simulation": is_simulation
            }, status=200)

        rules = rules.sort_values(by='lift', ascending=False).head(50)

        result = []
        for _, row in rules.iterrows():
            ant = list(row['antecedents'])
            con = list(row['consequents'])
            
            is_relevant = any(x in ['Reservation over 4h', 'Weekend reservation'] for x in con)
            
            if is_relevant:
                lift_val = round(row['lift'], 2)
                conf_val = round(row['confidence'] * 100)
                
                if conf_val >= 80: strength_label, color_class = "Certain", "green"
                elif conf_val >= 50: strength_label, color_class = "High", "blue"
                else: strength_label, color_class = "Moderate", "orange"

                result.append({
                    'przyczyna': ", ".join(ant),
                    'skutek': ", ".join(con),
                    'opis': f"When garage has: {', '.join(ant)}, there is a {conf_val}% chance for: {', '.join(con)}.",
                    'sila': strength_label,
                    'color_class': color_class,
                    'lift_score': lift_val,
                    'confidence': conf_val
                })

        if not result:
            return Response({
                "message": "Patterns found, but they do not concern equipment impact on characteristics.",
                "is_simulation": is_simulation
            }, status=200)

        if is_simulation:
            return Response({
                "rules": result,
                "is_simulation": True
            })
        
        return Response(result)

    except Exception as e:
        import traceback
        print(f"BŁĄD ML: {traceback.format_exc()}")
        return Response({"error": f"Processing error: {str(e)}"}, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_reservations_csv(request):
    if getattr(request.user, 'role', '') != 'admin':
        return Response({"error": "Permission denied."}, status=403)

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    reservations = Reservation.objects.filter(status__in=['confirmed', 'completed']).select_related('garage').prefetch_related('garage__equipment')

    if start_date:
        reservations = reservations.filter(start_time__date__gte=start_date)
    if end_date:
        reservations = reservations.filter(end_time__date__lte=end_date)
    
    reservations = reservations.order_by('-start_time')
    csv_content = generate_csv_data_for_ml(reservations)

    today = datetime.now().strftime('%Y-%m-%d')
    filename = f"analiza_dynamiczna_ml_{today}.csv"

    response = HttpResponse(csv_content, content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_historical_csv(request):
    if getattr(request.user, 'role', '') != 'admin':
        return Response({"error": "Permission denied."}, status=403)

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    reservations = Reservation.objects.all().select_related('garage')

    if start_date:
        reservations = reservations.filter(start_time__date__gte=start_date)
    if end_date:
        reservations = reservations.filter(end_time__date__lte=end_date)

    reservations = reservations.order_by('-start_time')

    today = datetime.now().strftime('%Y-%m-%d')
    filename = f"historia_rezerwacji_{today}.csv"

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write(u'\ufeff'.encode('utf8'))
    
    writer = csv.writer(response, delimiter=';')
    writer.writerow(['Garage Name', 'Start Date', 'End Date', 'Price', 'Status']) 

    for res in reservations:
        price_str = str(res.total_price).replace('.', ',')

        row = [
            res.garage.name,
            res.start_time.strftime('%Y-%m-%d %H:%M'),
            res.end_time.strftime('%Y-%m-%d %H:%M'),
            price_str,
            res.get_status_display() 
        ]
        writer.writerow(row)
    
    return response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_analytics_data(request):
    if getattr(request.user, 'role', '') != 'admin':
        return Response({"error": "Permission denied."}, status=403)

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    equipment_id = request.query_params.get('equipment_id') 

    reservations = Reservation.objects.filter(status__in=['confirmed', 'completed'])

    if start_date:
        reservations = reservations.filter(start_time__date__gte=start_date)
    if end_date:
        reservations = reservations.filter(end_time__date__lte=end_date)
    
    if equipment_id:
        reservations = reservations.filter(garage__equipment__id=equipment_id)

    revenue_data = (
        reservations
        .annotate(day=TruncDay('start_time'))
        .values('day')
        .annotate(total=Sum('total_price'))
        .order_by('day')
    )

    chart_revenue = {
        'labels': [item['day'].strftime('%Y-%m-%d') for item in revenue_data],
        'data': [float(item['total']) for item in revenue_data]
    }

    popularity_data = (
        reservations
        .values('garage__name')
        .annotate(count=Count('id'))
        .order_by('-count')
        [:10] 
    )

    chart_popularity = {
        'labels': [item['garage__name'] for item in popularity_data],
        'data': [item['count'] for item in popularity_data]
    }

    heatmap_matrix = [[0 for _ in range(24)] for _ in range(7)]
    
    for res in reservations:
        current = res.start_time
        while current < res.end_time:
            day_idx = current.weekday() 
            hour_idx = current.hour
            heatmap_matrix[day_idx][hour_idx] += 1
            current += timedelta(hours=1)

    return Response({
        'revenue': chart_revenue,
        'popularity': chart_popularity,
        'heatmap': heatmap_matrix
    })

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_system_config(request):
    config = SystemConfig.load()
    
    if request.method == 'GET':
        serializer = SystemConfigSerializer(config)
        return Response(serializer.data)
        
    elif request.method == 'POST':
        if getattr(request.user, 'role', '') != 'admin':
             return Response({'error': 'Permission denied'}, status=403)
             
        serializer = SystemConfigSerializer(config, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

@api_view(['GET'])
@permission_classes([IsSystemAdmin])
def export_decision_tree_csv(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="dane_statusu_{datetime.now().strftime("%Y%m%d")}.csv"'
    
    writer = csv.writer(response)
    
    equipment_list = Equipment.objects.all().order_by('id')
    equipment_headers = [f'has_{eq.name.lower().replace(" ", "_")}' for eq in equipment_list]
    
    headers = ['weekday', 'start_hour'] + equipment_headers + ['is_success']
    writer.writerow(headers)
    
    reservations = Reservation.objects.filter(status__in=['confirmed', 'completed', 'cancelled'])
    
    for res in reservations:
        weekday = res.start_time.weekday()
        start_hour = res.start_time.hour
        
        res_equipment_ids = set(res.garage.equipment.values_list('id', flat=True))
        equipment_row = []
        for eq in equipment_list:
            equipment_row.append(1 if eq.id in res_equipment_ids else 0)
            
        is_success = 1 if res.status in ['confirmed', 'completed'] else 0
        
        writer.writerow([weekday, start_hour] + equipment_row + [is_success])
        
    return response

@extend_schema(
    summary="Decision tree visualization",
    description="Generates tree image (PNG in Base64). GET: DB data. POST: CSV data.",
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {'type': 'string', 'format': 'binary'}
            }
        }
    },
    responses={200: OpenApiTypes.OBJECT}
)
@api_view(['GET', 'POST'])
@permission_classes([IsSystemAdmin])
def generate_decision_tree_image(request):
    try:
        if request.method == 'POST':
            if 'file' not in request.FILES:
                return Response({'error': 'No file was uploaded.'}, status=400)

            file = request.FILES['file']
            decoded_file = file.read().decode('utf-8')
            
            first_line = decoded_file.split('\n')[0]
            delimiter = ';' if ';' in first_line else ','
            
            io_string = io.StringIO(decoded_file)
            df_csv = pd.read_csv(io_string, delimiter=delimiter)
            
            required_cols = ['weekday', 'start_hour', 'is_success']
            missing_cols = [col for col in required_cols if col not in df_csv.columns]
            
            if missing_cols:
                return Response({
                    'error': f'Invalid CSV file format. Missing columns: {", ".join(missing_cols)}'
                }, status=400)

            if df_csv.empty or len(df_csv) < 5:
                return Response({
                    'error': f'Too little data in file (found {len(df_csv)}, minimum 5 reservations required)'
                }, status=400)

            if len(df_csv['is_success'].unique()) < 2:
                success_count = df_csv['is_success'].sum()
                total_count = len(df_csv)
                return Response({
                    'error': f'File contains only one status type ({success_count} success / {total_count-success_count} failure). Add reservations with different statuses.'
                }, status=400)

            equipment_cols = [col for col in df_csv.columns if col.startswith('has_')]
            
            feature_names = ['Day of week', 'Hour']
            for eq_col in equipment_cols:
                eq_name = eq_col.replace('has_', '').replace('_', ' ').title()
                feature_names.append(f"Has: {eq_name}?")
            
            X = df_csv[['weekday', 'start_hour'] + equipment_cols].copy()
            X.columns = feature_names
            y = df_csv['is_success']
            
            df = pd.concat([X, y.rename('Target')], axis=1)

        else:
            reservations = Reservation.objects.filter(status__in=['confirmed', 'completed', 'cancelled'])
            
            if not reservations.exists():
                return Response({'error': 'No data in database.'}, status=400)

            if reservations.count() < 5:
                return Response({'error': 'Too little data (minimum 5 reservations).'}, status=400)

            data = []
            equipment_list = Equipment.objects.all().order_by('id')
            feature_names = ['Day of week', 'Hour'] + [f"Has: {eq.name}?" for eq in equipment_list]
            
            targets = []

            for res in reservations:
                row = []
                row.append(res.start_time.weekday())
                row.append(res.start_time.hour)
                
                res_eq_ids = set(res.garage.equipment.values_list('id', flat=True))
                for eq in equipment_list:
                    row.append(1 if eq.id in res_eq_ids else 0)
                
                target = 1 if res.status in ['confirmed', 'completed'] else 0
                
                data.append(row + [target])
                targets.append(target)
                
            if len(set(targets)) < 2:
                return Response({'error': 'All reservations have the same status. Add some canceled reservations.'}, status=400)

            df = pd.DataFrame(data, columns=feature_names + ['Target'])

        X = df.drop('Target', axis=1)
        y = df['Target']
        
        if len(X) == 0:
            return Response({'error': 'No data for analysis after filtering.'}, status=400)
        
        clf = DecisionTreeClassifier(max_depth=3, random_state=42, min_samples_leaf=2)
        clf.fit(X, y)
        
        plt.figure(figsize=(16, 8))
        
        annotations = plot_tree(
            clf, 
            feature_names=list(X.columns),
            class_names=['CANCELED', 'COMPLETED'],
            filled=True, 
            rounded=True, 
            fontsize=11,
            impurity=False,
            label='none',
            node_ids=False,
            proportion=False
        )
        
        for text in annotations:
            current_text = text.get_text()
            
            if "<=" in current_text:
                parts = current_text.split("<=")
                feature_name = parts[0].strip()
                val_str = parts[1].strip().split('\n')[0]
                
                try:
                    val = float(val_str)
                    if "Hour" in feature_name:
                        hour = int(val)
                        minute = int((val - hour) * 60)
                        time_str = f"{hour}:{minute:02d}"
                        text.set_text(f"Before {time_str}?")
                    elif "Day" in feature_name:
                        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                        day_idx = int(val)
                        day_name = days[min(day_idx, 6)]
                        text.set_text(f"Before {day_name}?")
                    elif "Has:" in feature_name:
                        clean_name = feature_name.replace("Has: ", "").replace("?", "")
                        text.set_text(f"NO: {clean_name}?")
                    else:
                        text.set_text(f"{feature_name} <= {val}")
                    text.set_fontweight('bold')
                except:
                    pass

            elif "CANCELED" in current_text or "COMPLETED" in current_text:
                if "CANCELED" in current_text:
                    text.set_text("RESULT:\nCANCELED")
                else:
                    text.set_text("RESULT:\nSUCCESS")
                text.set_fontsize(12)
                text.set_fontweight('bold')
            else:
                text.set_text("")

        plt.title("What affects reservation success? (Churn Analysis)", fontsize=16, fontweight='bold', pad=20)
        plt.figtext(0.5, 0.02, "LEFT branch side = YES (condition met)   |   RIGHT branch side = NO (condition not met)", 
                    ha="center", fontsize=10, bbox={"facecolor":"orange", "alpha":0.2, "pad":5})

        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
        plt.close()
        buf.seek(0)
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return Response({'image': f'data:image/png;base64,{image_base64}'})

    except Exception as e:
        import traceback
        print("BŁĄD DRZEWA:")
        print(traceback.format_exc())
        return Response({'error': f'Server error: {str(e)}'}, status=500)