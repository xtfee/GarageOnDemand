from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from .models import Garage, Reservation, SystemConfig, Equipment
from .serializers import ReservationSerializer

User = get_user_model()

class GarageModelTest(TestCase):
    """
    Test 1: Warstwa Danych (Models)
    Sprawdza, czy podstawowe modele tworzą się poprawnie w bazie.
    """
    def setUp(self):
        self.garage = Garage.objects.create(
            name="Garaż Testowy Centrum",
            address="ul. Marszałkowska 1",
            price_per_hour=50.00,
            width=3.5,
            length=6.0,
            height=2.5
        )

    def test_garage_creation(self):
        """Sprawdza poprawność zapisu pól modelu Garage"""
        self.assertEqual(self.garage.name, "Garaż Testowy Centrum")
        self.assertEqual(self.garage.price_per_hour, 50.00)
        self.assertTrue(self.garage.is_active)
        self.assertEqual(str(self.garage), "Garaż Testowy Centrum")

    def test_equipment_relation(self):
        """Sprawdza relację ManyToMany z wyposażeniem"""
        eq = Equipment.objects.create(name="Podnośnik", icon="🔧")
        self.garage.equipment.add(eq)
        self.assertIn(eq, self.garage.equipment.all())


class ReservationBusinessLogicTest(TestCase):
    """
    Test 2: Logika Biznesowa (Serializer Logic)
    Tutaj testujemy 'mózg' aplikacji: obliczanie cen i walidację terminów.
    """
    def setUp(self):
        self.user = User.objects.create_user(username='tester', password='password123')
        self.garage = Garage.objects.create(
            name="Garaż Logiczny",
            address="ul. Testowa 5",
            price_per_hour=100.00,
            price_per_day=500.00
        )
        # Upewniamy się, że konfiguracja systemu istnieje
        SystemConfig.load()

    def test_price_calculation_hourly(self):
        """Sprawdza, czy serializer poprawnie liczy cenę za godziny"""
        now = timezone.now() + timedelta(days=1)
        start = now.replace(minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=2) # 2 godziny

        data = {
            'garage': self.garage.id,
            'start_time': start,
            'end_time': end
        }

        # Używamy context={'request': ...} bo serializer pobiera usera z requestu
        request = APIClient().request()
        request.user = self.user
        
        serializer = ReservationSerializer(data=data, context={'request': request})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        
        # Cena: 2h * 100zł = 200zł
        self.assertEqual(serializer.validated_data['total_price'], Decimal('200.00'))

    def test_validation_overlapping_dates(self):
        """Sprawdza, czy system blokuje rezerwację w zajętym terminie"""
        now = timezone.now() + timedelta(days=2)
        start = now.replace(minute=0, second=0)
        end = start + timedelta(hours=4)

        # Tworzymy pierwszą rezerwację (zajmujemy termin)
        Reservation.objects.create(
            user=self.user,
            garage=self.garage,
            start_time=start,
            end_time=end,
            total_price=400.00,
            status='confirmed'
        )

        # Próbujemy stworzyć drugą w tym samym czasie
        data = {
            'garage': self.garage.id,
            'start_time': start,
            'end_time': end
        }
        
        request = APIClient().request()
        request.user = self.user
        
        serializer = ReservationSerializer(data=data, context={'request': request})
        
        # Powinien zwrócić błąd walidacji
        self.assertFalse(serializer.is_valid())
        self.assertIn("The garage is already occupied in this time slot", str(serializer.errors))

    def test_validation_past_dates(self):
        """Sprawdza, czy nie można rezerwować w przeszłości"""
        past_start = timezone.now() - timedelta(hours=5)
        past_end = timezone.now() - timedelta(hours=3)

        data = {
            'garage': self.garage.id,
            'start_time': past_start,
            'end_time': past_end
        }
        
        request = APIClient().request()
        request.user = self.user
        serializer = ReservationSerializer(data=data, context={'request': request})
        
        self.assertFalse(serializer.is_valid())
        self.assertIn("You cannot make a reservation in the past", str(serializer.errors))


class GarageAPITest(APITestCase):
    """
    Test 3: API Integration
    Sprawdza czy endpointy REST reagują poprawnie (status 200/201/401).
    """
    def setUp(self):
        self.user = User.objects.create_user(username='api_user', password='password123')
        self.garage = Garage.objects.create(
            name="Garaż API",
            address="ul. Internetowa 404",
            price_per_hour=10.00
        )
        # URL do listy garaży (zgodnie z routerem w urls.py: router.register(r'list', ...))
        self.list_url = '/api/garages/list/' 
        # URL do rezerwacji (zgodnie z routerem: router.register(r'reservations', ...))
        self.reservation_url = '/api/garages/reservations/'

    def test_get_garage_list(self):
        """Publiczny dostęp do listy garaży"""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], "Garaż API")

    def test_create_reservation_authorized(self):
        """Zalogowany użytkownik tworzy rezerwację"""
        self.client.force_authenticate(user=self.user)
        
        start = timezone.now() + timedelta(days=3)
        end = start + timedelta(hours=1)

        data = {
            "garage": self.garage.id,
            "start_time": start,
            "end_time": end
        }

        response = self.client.post(self.reservation_url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Reservation.objects.count(), 1)
        self.assertEqual(Reservation.objects.get().user, self.user)

    def test_create_reservation_unauthorized(self):
        """Niezalogowany użytkownik nie może rezerwować"""
        # Brak force_authenticate
        
        start = timezone.now() + timedelta(days=3)
        end = start + timedelta(hours=1)
        
        data = {
            "garage": self.garage.id,
            "start_time": start,
            "end_time": end
        }

        response = self.client.post(self.reservation_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)