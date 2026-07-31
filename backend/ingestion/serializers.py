from rest_framework import serializers
from .models import ContentSource

class ContentSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentSource
        fields = ['id', 'workspace', 'url', 'source_type', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
