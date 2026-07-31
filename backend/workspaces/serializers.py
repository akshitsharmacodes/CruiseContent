from rest_framework import serializers
from .models import Workspace, BusinessProfile

class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ['id', 'name', 'open_ai_key', 'created_at']
        read_only_fields = ['id', 'created_at']

class BusinessProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessProfile
        fields = [
            'id', 'owner_name', 'business_name', 'established_date', 
            'opening_hours', 'operational_procedures', 'is_online_or_remote', 
            'physical_location_type', 'services_provided', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
