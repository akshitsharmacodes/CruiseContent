from rest_framework.views import APIView
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import Workspace, BusinessProfile
from .serializers import WorkspaceSerializer, BusinessProfileSerializer

class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.request.user.workspaces.all().order_by('-created_at')

class BusinessProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            profile = user.business_profile
            serializer = BusinessProfileSerializer(profile)
            return Response(serializer.data)
        except BusinessProfile.DoesNotExist:
            return Response({"detail": "Profile not found", "onboarding_required": True}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        user = request.user
        try:
            profile = user.business_profile
            serializer = BusinessProfileSerializer(profile, data=request.data, partial=True)
        except BusinessProfile.DoesNotExist:
            serializer = BusinessProfileSerializer(data=request.data)
            
        if serializer.is_valid():
            serializer.save(user=user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OnboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        user = request.user
        data = request.data
        
        business_name = data.get('business_name', 'My Business')
        
        # 1. Create BusinessProfile
        profile_serializer = BusinessProfileSerializer(data=data)
        if profile_serializer.is_valid():
            profile_serializer.save(user=user)
        else:
            return Response(profile_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        # 2. Create Workspace
        workspace = Workspace.objects.create(name=f"{business_name} Workspace")
        
        # 3. Link Workspace to User
        user.current_workspace = workspace
        user.save()
        user.workspaces.add(workspace)
        
        return Response({"message": "Onboarding completed successfully!"}, status=status.HTTP_201_CREATED)

class SwitchWorkspaceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            return Response({"error": "workspace_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        workspace = get_object_or_404(Workspace, id=workspace_id, users=request.user)
        request.user.current_workspace = workspace
        request.user.save()
        
        return Response({"message": "Switched workspace successfully", "current_workspace_id": workspace.id})
