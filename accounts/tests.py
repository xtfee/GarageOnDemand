from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .serializers import UserSerializer

User = get_user_model()

class UserModelTest(TestCase):
    """
    Test 1: Warstwa Modelu Danych
    Sprawdzamy, czy niestandardowy użytkownik (Custom User) tworzy się poprawnie.
    """

    def test_create_user(self):
        user = User.objects.create_user(
            username='jan_kowalski',
            email='jan@test.pl',
            password='strong_password',
            phone_number='123456789',
            role='client'
        )
        self.assertEqual(user.username, 'jan_kowalski')
        self.assertEqual(user.phone_number, '123456789')
        self.assertEqual(user.role, 'client')
        self.assertTrue(user.check_password('strong_password'))  # Czy hasło jest zahaszowane?
        self.assertFalse(user.email_verified) # Domyślnie false

    def test_string_representation(self):
        """Czy __str__ zwraca format 'username (Rola)'?"""
        user = User.objects.create_user(username='admin', role='admin', phone_number='111')
        self.assertEqual(str(user), "admin (Administrator)")


class UserSerializerLogicTest(TestCase):
    """
    Test 2: Logika Serializera
    Tu sprawdzamy, czy serializer blokuje niedozwolone działania (np. zmianę roli).
    """

    def setUp(self):
        self.user_data = {
            'username': 'serializer_test',
            'email': 'ser@test.pl',
            'password': 'password123',
            'phone_number': '500600700',
            'role': 'client'
        }

    def test_serializer_creates_user(self):
        """Czy serializer poprawnie tworzy usera z hashowaniem hasła"""
        serializer = UserSerializer(data=self.user_data)
        self.assertTrue(serializer.is_valid())
        user = serializer.save()
        
        self.assertNotEqual(user.password, 'password123')  # Hasło nie może być plain textem
        self.assertTrue(user.check_password('password123'))
        self.assertEqual(user.phone_number, '500600700')

    def test_serializer_validation_phone(self):
        """Czy serializer wymaga numeru telefonu (zgodnie z kodem: required=True)"""
        data_no_phone = self.user_data.copy()
        del data_no_phone['phone_number']
        
        serializer = UserSerializer(data=data_no_phone)
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone_number', serializer.errors)

    def test_security_prevent_role_change(self):
        """Czy serializer ignoruje próbę zmiany roli podczas edycji"""
        # Tworzymy usera 'client'
        user = User.objects.create_user(username='hacker', role='client', phone_number='123')
        
        # Próbujemy zmienić mu imię ORAZ rolę na admina
        update_data = {
            'first_name': 'HackerName',
            'role': 'admin',  # To powinno zostać zignorowane
            'phone_number': '123'
        }
        
        serializer = UserSerializer(instance=user, data=update_data, partial=True)
        self.assertTrue(serializer.is_valid())
        serializer.save()
        
        user.refresh_from_db()
        self.assertEqual(user.first_name, 'HackerName')
        self.assertEqual(user.role, 'client') # Rola nadal powinna być client!


class AuthenticationAPITest(APITestCase):
    """
    Test 3: Integracja API (Rejestracja, Logowanie, Profil)
    """

    def setUp(self):
        # URLe pobieramy po nazwach z urls.py, żeby było elastycznie
        self.register_url = reverse('api_register')
        self.login_url = reverse('api_login')
        self.profile_url = reverse('user_profile')

        # Tworzymy usera do testów logowania
        self.user = User.objects.create_user(
            username='api_user', 
            password='password123', 
            email='api@test.pl',
            phone_number='999888777'
        )

    def test_register_user(self):
        """Czy endpoint rejestracji działa"""
        data = {
            'username': 'new_user',
            'email': 'new@test.pl',
            'password': 'newpassword123',
            'phone_number': '111222333',
            'role': 'client'
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='new_user').exists())

    def test_login_user(self):
        """Czy logowanie zwraca token"""
        data = {
            'username': 'api_user',
            'password': 'password123'
        }
        response = self.client.post(self.login_url, data)
        
        # Sprawdzamy status 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Sprawdzamy czy token jest w odpowiedzi
        self.assertIn('token', response.data)
        
        # POPRAWKA: Sprawdzamy 'role' i 'username' zamiast 'user_id'
        # (bo Twój widok CustomAuthToken zwraca: token, role, username, email)
        self.assertIn('role', response.data)
        self.assertIn('username', response.data)

    def test_get_profile_authenticated(self):
        """Czy zalogowany user widzi swój profil"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.profile_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'api_user')
        self.assertEqual(response.data['phone_number'], '999888777')

    def test_get_profile_unauthenticated(self):
        """Czy niezalogowany user dostaje 401 przy próbie wejścia w profil"""
        # Brak force_authenticate
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)