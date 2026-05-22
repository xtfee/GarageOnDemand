from django.contrib import admin
from .models import Equipment, Garage, Reservation, Payment

@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(Garage)
class GarageAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'price_per_hour')
    filter_horizontal = ('equipment',)

@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'garage', 'start_time', 'status', 'access_code')
    list_filter = ('status', 'garage')
    search_fields = ('user__username', 'garage__name')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('reservation', 'amount', 'timestamp', 'is_refunded')
    list_filter = ('timestamp', 'is_refunded')