from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GarageViewSet, EquipmentViewSet, ReservationViewSet, save_payment_success, 
    export_reservations_csv, export_historical_csv, import_historical_csv, get_ml_rules,
    get_analytics_data, manage_system_config, simulate_analytics_csv,
    export_decision_tree_csv, generate_decision_tree_image
)

router = DefaultRouter()
router.register(r'list', GarageViewSet)
router.register(r'equipment', EquipmentViewSet)
router.register(r'reservations', ReservationViewSet, basename='reservations')

urlpatterns = [
    path('', include(router.urls)),
    path('save-payment/', save_payment_success, name='save-payment'),
    path('export/', export_reservations_csv, name='export-reservations-ml'),
    path('export-history/', export_historical_csv, name='export-history-csv'),
    path('import-history/', import_historical_csv, name='import-history-csv'),
    path('analyze-csv/', simulate_analytics_csv, name='analyze-csv'),
    path('ml-results/', get_ml_rules, name='ml-rules-api'),
    path('analytics-data/', get_analytics_data, name='analytics-data'),
    path('system-config/', manage_system_config, name='system-config'),
    path('export-decision-tree/', export_decision_tree_csv, name='export-decision-tree'),
    path('visualize-decision-tree/', generate_decision_tree_image, name='visualize-decision-tree'),
]