from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import generics, permissions, status, viewsets
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils.html import format_html
from django.shortcuts import redirect  # <--- DODANE

# Swagger / OpenAPI imports
from drf_spectacular.utils import extend_schema, OpenApiTypes
from rest_framework import serializers

from .serializers import UserSerializer, ChangePasswordSerializer

User = get_user_model()

# Serializer pomocniczy tylko dla dokumentacji Swaggera (definiuje strukturę odpowiedzi logowania)
class TokenResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    role = serializers.CharField()
    username = serializers.CharField()
    email = serializers.EmailField()

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(username=username, password=password)
        
        if user is None:
            user_exists = User.objects.filter(username=username).first()
            
            if user_exists:
                if not user_exists.email_verified:
                    return Response(
                        {"error": "Account requires verification. Check your email inbox."},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                
                if not user_exists.is_active:
                    return Response(
                        {"error": "Your account has been blocked by an administrator."},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
               
                return Response(
                    {"error": "Invalid login credentials."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response(
                {"error": "Invalid login credentials."},
                status=status.HTTP_400_BAD_REQUEST
            )

        
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'role': getattr(user, 'role', 'client'),
            'username': user.username,
            'email': user.email
        })

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Register a new user",
        description="Creates an account and sends an activation link by email.",
        request=UserSerializer,
        responses={
            201: OpenApiTypes.OBJECT,
            400: OpenApiTypes.OBJECT
        }
    )
    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            user.is_active = False
            user.email_verified = False
            user.save()

            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Dostosuj URL do swojego frontendu
            verification_link = f"http://localhost:5173/verify/{uid}/{token}"

            subject = "Activate your account - Garage System"
            message = f"Hello {user.username}!\n\nClick the link to activate your account: {verification_link}"

            html_message = format_html(
                "Hello <strong>{}</strong>!<br><br>"
                "Thank you for registering in the Garage Management System.<br>"
                "To log in, please confirm your email address by clicking the link below:<br><br>"
                '<a href="{}" style="color: #4A90E2; font-weight: bold; text-decoration: underline;">'
                "Click here to activate your account</a><br><br>"
                "If the link does not work, copy it into your browser:<br>{}<br><br>"
                "If you did not create this account, ignore this message.",
                user.username, verification_link, verification_link
            )
            
            # Always log the link so the demo works even if SMTP is unavailable
            print("\n" + "=" * 70)
            print(f"  ACCOUNT VERIFICATION LINK for {user.email}")
            print(f"  {verification_link}")
            print("=" * 70 + "\n")

            try:
                send_mail(
                    subject,
                    message,
                    settings.EMAIL_HOST_USER,
                    [user.email],
                    fail_silently=False,
                    html_message=html_message
                )
            except Exception as e:
                print(f"[WARNING] Email sending failed: {e}")
                print("[INFO] Use the verification link printed above to activate the account.")

            return Response(
                {"message": "Account created. The activation link was sent to your email."}, 
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.email_verified = True  # Potwierdzasz maila
            user.is_active = True       # <--- TO JEST KLUCZOWE: Aktywujesz konto
            user.save()
            return Response({"message": "Email verified! You can log in now."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "The link has expired."}, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    def post(self, request):
        return Response({"message": "Logged out"}, status=status.HTTP_200_OK)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        password_confirmation = request.data.get('password_confirmation')
        
        if not password_confirmation:
            return Response(
                {"password_error": "To save changes, you must confirm your identity by entering your password."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.check_password(password_confirmation):
            return Response(
                {"password_error": "The provided password is invalid."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        new_email = request.data.get('email')
        current_email = request.user.email

        if new_email and new_email != current_email:
            if User.objects.filter(email=new_email).exists():
                return Response(
                    {"email_error": "This email address is already used by another user."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            token = default_token_generator.make_token(request.user)
            uid = urlsafe_base64_encode(force_bytes(request.user.pk))
            new_email_b64 = urlsafe_base64_encode(force_bytes(new_email))
            
            # Dostosuj URL do swojego frontendu
            verification_link = f"http://localhost:5173/confirm-email/{uid}/{token}/{new_email_b64}"

            subject = "Confirm email address change"
            html_message = format_html(
                "Hello <strong>{}</strong>!<br><br>"
                "We received a request to change your email address to: <strong>{}</strong>.<br>"
                "To approve the change, click the link below:<br><br>"
                '<a href="{}" style="color: #4A90E2; font-weight: bold; text-decoration: underline;">'
                "I CONFIRM THE EMAIL CHANGE</a><br><br>"
                "If this was not you, ignore this message - your current email will remain unchanged.",
                request.user.username, new_email, verification_link, verification_link
            )
            
            # Always log the link so the demo works even if SMTP is unavailable
            print("\n" + "=" * 70)
            print(f"  EMAIL CHANGE CONFIRMATION LINK for {new_email}")
            print(f"  {verification_link}")
            print("=" * 70 + "\n")

            try:
                send_mail(subject, "", settings.EMAIL_HOST_USER, [new_email], fail_silently=False, html_message=html_message)
            except Exception as e:
                print(f"[WARNING] Email sending failed: {e}")
                print("[INFO] Use the verification link printed above.")

            if isinstance(request.data, dict):
                request.data['email'] = current_email 
            else:
                data = request.data.copy()
                data['email'] = current_email
                request._data = data

        return super().update(request, *args, **kwargs)

class ConfirmEmailChangeView(APIView):
    permission_classes = [permissions.AllowAny] 

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        emailb64 = request.data.get('emailb64')

        if not all([uidb64, token, emailb64]):
            return Response({"error": "Missing verification data."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
            new_email = force_str(urlsafe_base64_decode(emailb64))
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)

        if default_token_generator.check_token(user, token):
            if User.objects.filter(email=new_email).exists():
                 return Response({"error": "This email address has been taken in the meantime."}, status=status.HTTP_400_BAD_REQUEST)
            
            user.email = new_email
            user.save()
            return Response({"message": "Email address changed successfully!"}, status=status.HTTP_200_OK)
        
        return Response({"error": "The link has expired or is invalid."}, status=status.HTTP_400_BAD_REQUEST)

class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self): 
        return self.request.user
        
    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            if not user.check_password(serializer.data.get("old_password")):
                return Response({"old_password": ["Incorrect old password."]}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(serializer.data.get("new_password"))
            user.save()
            return Response({"message": "Password changed."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DeleteUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request):
        user = request.user
        password = request.data.get('password')
        if not password: 
            return Response({"error": "Password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(password): 
            return Response({"error": "Incorrect password."}, status=status.HTTP_403_FORBIDDEN)
        user.delete()
        return Response({"message": "Account deleted."}, status=status.HTTP_204_NO_CONTENT)

# <--- DODANE (Widok sukcesu logowania Google) --->
def social_login_success(request):
    """
    Widok wywoływany przez Allauth po sukcesie w Google.
    Generuje token DRF i wysyła go do Frontendu w URL.
    """
    if not request.user.is_authenticated:
        return redirect(f"{settings.FRONTEND_URL}/login?error=auth_failed")

    user = request.user
    if not (user.username or '').strip():
        candidate = (user.email or '').split('@')[0] or f"user_{user.pk}"
        base = candidate
        suffix = 1
        while User.objects.filter(username=candidate).exclude(pk=user.pk).exists():
            suffix += 1
            candidate = f"{base}{suffix}"
        user.username = candidate
        user.save(update_fields=['username'])

    token, _ = Token.objects.get_or_create(user=user)
    return redirect(f"{settings.FRONTEND_URL}/auth-callback?token={token.key}")