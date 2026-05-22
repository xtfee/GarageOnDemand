from django.urls import path
from .views import EquipmentPopularityView

urlpatterns = [
    
    path('equipment-stats/', EquipmentPopularityView.as_view(), name='equipment-stats'),
]