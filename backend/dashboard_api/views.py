from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

class DashboardStatusView(APIView):
    permission_classes = [permissions.AllowAny] # Open for testing right now

    def get(self, request):
        return Response({
            "status": "success",
            "message": "Connected to the Automated Social Media Content Engine API!",
            "pending_drafts": 5,
            "connected_platforms": ["FACEBOOK_PAGE", "LINKEDIN"]
        })
