from rest_framework.views import APIView
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Workspace, BusinessProfile
from .serializers import WorkspaceSerializer, BusinessProfileSerializer

class WorkspaceViewSet(viewsets.ModelViewSet):
    queryset = Workspace.objects.all().order_by('-created_at')
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.AllowAny] # Open for first iteration

class BusinessProfileView(APIView):
    permission_classes = [permissions.AllowAny] # Mock auth for now, in prod we'd use IsAuthenticated

    def get(self, request):
        # MOCK: In production, we'd do request.user
        # For now, we'll just get the first user in the DB, or create a mock user
        from workspaces.models import User
        user = User.objects.first()
        if not user:
            return Response({"error": "No users found in database"}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            profile = user.business_profile
            serializer = BusinessProfileSerializer(profile)
            return Response(serializer.data)
        except BusinessProfile.DoesNotExist:
            return Response({"detail": "Profile not found", "onboarding_required": True}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        from workspaces.models import User
        user = User.objects.first()
        if not user:
            # Create a mock user if none exists so frontend works seamlessly
            user = User.objects.create(username="mockuser", email="mock@example.com")
        
        try:
            profile = user.business_profile
            serializer = BusinessProfileSerializer(profile, data=request.data, partial=True)
        except BusinessProfile.DoesNotExist:
            serializer = BusinessProfileSerializer(data=request.data)
            
        if serializer.is_valid():
            serializer.save(user=user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
