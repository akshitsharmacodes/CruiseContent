from rest_framework import viewsets, permissions
from .models import ContentSource, GenerationTask
from .serializers import ContentSourceSerializer

class ContentSourceViewSet(viewsets.ModelViewSet):
    serializer_class = ContentSourceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = ContentSource.objects.all().order_by('-created_at')
        workspace_id = self.request.query_params.get('workspace')
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)
        return queryset

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .tasks import process_generation
import traceback
import sys

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def generate_post(request):
    try:
        data = request.data
        input_type = data.get('input_type', 'text')
        input_data = data.get('input_data', '')
        user_image_prompt = data.get('user_image_prompt', '')
        generate_image = data.get('generate_image', True)
        platforms = data.get('platforms', [])
        
        # Fallback override: Instagram requires an image
        if 'instagram' in platforms:
            generate_image = True
        
        task = GenerationTask.objects.create(
            input_type=input_type,
            input_data=input_data,
            user_image_prompt=user_image_prompt,
            generate_image=generate_image,
            status='Pending'
        )
        
        process_generation.delay(task.id, platforms)
        
        return Response({'task_id': task.id, 'status': 'Pending'})
        
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        tb = traceback.extract_tb(exc_traceback)
        last_call = tb[-1]
        error_msg = f"Error in {last_call.filename} at line {last_call.lineno}: {str(e)}"
        return Response({'error': error_msg}, status=500)

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def poll_task(request, task_id):
    try:
        task = GenerationTask.objects.get(id=task_id)
        return Response({
            'task_id': task.id,
            'status': task.status,
            'generated_content': task.generated_content,
            'error_message': task.error_message
        })
    except GenerationTask.DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        tb = traceback.extract_tb(exc_traceback)
        last_call = tb[-1]
        error_msg = f"Error in {last_call.filename} at line {last_call.lineno}: {str(e)}"
        return Response({'error': error_msg}, status=500)
