from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count
from garages.models import Equipment
from rest_framework.permissions import IsAuthenticated

class EquipmentPopularityView(APIView):
    
    permission_classes = [IsAuthenticated]

    def get(self, request):
       
        stats = Equipment.objects.annotate(
            reservation_count=Count('garages__reservation')
        ).order_by('-reservation_count')

        
        data = {
            'labels': [item.name for item in stats],
            'series': [item.reservation_count for item in stats]
        }
        
        return Response(data)