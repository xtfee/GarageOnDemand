from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomAuthToken, LogoutView, RegisterView, UserViewSet, UserProfileView, DeleteUserView, ChangePasswordView, VerifyEmailView, ConfirmEmailChangeView, social_login_success # <--- DODANY IMPORT

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
    path('login/', CustomAuthToken.as_view(), name='api_login'),
    path('logout/', LogoutView.as_view(), name='api_logout'),
    path('register/', RegisterView.as_view(), name='api_register'),
    path('profile/', UserProfileView.as_view(), name='user_profile'), 
    path('change-password/', ChangePasswordView.as_view(), name='change_password'), 
    path('delete/', DeleteUserView.as_view(), name='delete_user'),  
    path('verify/<str:uidb64>/<str:token>/', VerifyEmailView.as_view(), name='verify_email'),
    path('confirm-email-change/', ConfirmEmailChangeView.as_view(), name='confirm_email_change'),
    path('social/success/', social_login_success, name='social-success'),
]