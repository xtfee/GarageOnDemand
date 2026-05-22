from rest_framework import serializers
from .models import Garage, Equipment, Reservation, Payment, SystemConfig
from datetime import timedelta
from django.utils import timezone
from decimal import Decimal

class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = '__all__'

class GarageSerializer(serializers.ModelSerializer):
    # Dodajemy dedykowane pole do wyświetlania szczegółów sprzętu
    equipment_details = EquipmentSerializer(source='equipment', many=True, read_only=True)

    class Meta:
        model = Garage
        fields = [
            'id', 'name', 'address', 'price_per_hour', 'price_per_day', 
            'image', 'description', 'equipment', 'equipment_details', # 
            'width', 'length', 'height', 'is_active'
        ]

class ReservationSerializer(serializers.ModelSerializer):
    garage_details = GarageSerializer(source='garage', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Reservation
        fields = '__all__'
        read_only_fields = ('user', 'total_price', 'status', 'access_code', 'created_at', 'overstayed', 'cancellation_reason', 'cancellation_seen')

    def validate(self, data):
        start = data.get('start_time')
        end = data.get('end_time')
        garage = data.get('garage')
        user = self.context['request'].user

        if start:
            start = start.replace(second=0, microsecond=0)
            data['start_time'] = start
        if end:
            end = end.replace(second=0, microsecond=0)
            data['end_time'] = end
        
        if Reservation.objects.filter(user=user, overstayed=True).exists():
            raise serializers.ValidationError("You have outstanding liabilities (overstayed reservation). Contact the administration.")

        config = SystemConfig.load()

        if start >= end:
            raise serializers.ValidationError("End date must be later than start date.")
        
        if start < timezone.now():
            raise serializers.ValidationError("You cannot make a reservation in the past.")

        duration = end - start
        max_days = config.max_reservation_days
        if duration > timedelta(days=max_days):
            raise serializers.ValidationError(f"Maximum reservation duration is {max_days} days.")

        if not self.instance: 
            active_count = Reservation.objects.filter(
                user=user,
                status__in=['pending', 'confirmed'],
                end_time__gt=timezone.now()
            ).count()
            
            if active_count >= config.max_active_reservations:
                raise serializers.ValidationError(f"Limit of {config.max_active_reservations} active reservations reached.")

        overlapping = Reservation.objects.filter(
            garage=garage,
            status__in=['confirmed', 'pending'],
            start_time__lt=end,
            end_time__gt=start
        )
        
        if self.instance:
            overlapping = overlapping.exclude(pk=self.instance.pk)

        if overlapping.exists():
            raise serializers.ValidationError("The garage is already occupied in this time slot.")
            
        total_seconds = duration.total_seconds()
        hours_total = total_seconds / 3600
        
        price_per_hour = float(garage.price_per_hour)
        price_per_day = float(garage.price_per_day) if garage.price_per_day else None

        if price_per_day and hours_total >= 24:
            days = int(hours_total // 24)
            remaining_hours = hours_total % 24
            total_price = (days * price_per_day) + (remaining_hours * price_per_hour)
        else:
            total_price = hours_total * price_per_hour
            if price_per_day and total_price > price_per_day:
                total_price = price_per_day

        data['total_price'] = round(total_price, 2)

        return data

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class SystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = '__all__'