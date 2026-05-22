from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

class CustomUserAdmin(UserAdmin):
    model = User
    # Wyświetlamy rolę na liście użytkowników
    list_display = ['username', 'email', 'role', 'is_staff', 'is_active']
    
    # Dodajemy pole 'role' do formularza edycji użytkownika
    fieldsets = UserAdmin.fieldsets + (
        ('Dodatkowe informacje', {'fields': ('role',)}),
    )
    # Dodajemy pole 'role' do formularza tworzenia użytkownika
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Dodatkowe informacje', {'fields': ('role',)}),
    )

admin.site.register(User, CustomUserAdmin)