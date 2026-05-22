from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class Garage(models.Model):
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=255)
    price_per_hour = models.DecimalField(max_digits=6, decimal_places=2)
    price_per_day = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    image = models.ImageField(upload_to='garages/', null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    equipment = models.ManyToManyField('Equipment', blank=True)
    width = models.FloatField(help_text="Width in meters", null=True, blank=True)
    length = models.FloatField(help_text="Length in meters", null=True, blank=True)
    height = models.FloatField(help_text="Height in meters", null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Equipment(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True, help_text="Nazwa ikony lub emoji")

    def __str__(self):
        return self.name

class Reservation(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Awaiting payment'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Canceled'),
        ('completed', 'Completed'),
        ('expired', 'Expired (No payment)'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reservations')
    garage = models.ForeignKey(Garage, on_delete=models.CASCADE, related_name='reservations')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    access_code = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_historical = models.BooleanField(default=False)
    
    # Przesiadywacz
    overstayed = models.BooleanField(default=False, help_text="Did the customer stay in the garage after the reservation time?")

    # NOWE POLA DO ANULACJI
    cancellation_reason = models.TextField(blank=True, null=True, help_text="Cancellation reason provided by admin")
    cancellation_seen = models.BooleanField(default=False, help_text="Has the user read the cancellation notification?")

    def __str__(self):
        return f"Res {self.id} - {self.user} ({self.status})"

class Payment(models.Model):
    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name='payments')
    stripe_charge_id = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_refunded = models.BooleanField(default=False)

    def __str__(self):
        return f"Pay {self.id} for Res {self.reservation.id}"

class SystemConfig(models.Model):
    refund_limit_hours = models.IntegerField(default=24, help_text="How many hours before start cancellation is free")
    base_hour_price = models.DecimalField(default=50.00, max_digits=6, decimal_places=2)
    base_day_price = models.DecimalField(default=350.00, max_digits=6, decimal_places=2)
    
    max_active_reservations = models.IntegerField(default=3, help_text="Maximum number of active reservations per user")
    max_reservation_days = models.IntegerField(default=7, help_text="Maximum length of one reservation in days")

    def save(self, *args, **kwargs):
        if not self.pk and SystemConfig.objects.exists():
            raise ValidationError('Only one system configuration can exist.')
        return super(SystemConfig, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "System Configuration"