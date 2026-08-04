from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db.models import Count
from .models import ClientProfile

User = get_user_model()

class IsSuperAdminPermission(IsAuthenticated):
    """
    Custom permission to only allow akshitsharmacodes@gmail.com.
    """
    def has_permission(self, request, view):
        is_auth = super().has_permission(request, view)
        if not is_auth:
            return False
        return request.user.email == 'akshitsharmacodes@gmail.com'

class AdminUsersView(APIView):
    permission_classes = [IsSuperAdminPermission]

    def get(self, request):
        users = User.objects.select_related('profile').all().order_by('-date_joined')
        data = []
        for u in users:
            profile = getattr(u, 'profile', None)
            data.append({
                'id': u.id,
                'email': u.email,
                'date_joined': u.date_joined.isoformat() if u.date_joined else None,
                'tier': profile.tier if profile else 'FREE',
                'posts_created': profile.posts_created if profile else 0,
                'publish_clicks': profile.publish_clicks if profile else 0,
                'picture': profile.profile_picture if profile else None,
            })
        return Response(data)

class AdminUpdateTierView(APIView):
    permission_classes = [IsSuperAdminPermission]

    def post(self, request, user_id):
        new_tier = request.data.get('tier')
        valid_tiers = [choice[0] for choice in ClientProfile.TIER_CHOICES]
        
        if new_tier not in valid_tiers:
            return Response({'error': 'Invalid tier'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            user = User.objects.get(id=user_id)
            profile = user.profile
            profile.tier = new_tier
            profile.save()
            return Response({'message': f'Successfully updated user {user.email} to tier {new_tier}'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
