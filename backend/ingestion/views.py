from rest_framework import viewsets, permissions
from .models import ContentSource, GenerationTask
from .serializers import ContentSourceSerializer
from workspaces.permissions import HasWorkspaceRole                     

class ContentSourceViewSet(viewsets.ModelViewSet):
    serializer_class = ContentSourceSerializer
    permission_classes = [permissions.IsAuthenticated, HasWorkspaceRole]
    workspace_roles_required = ['OWNER', 'ADMIN', 'MEMBER']

    def get_queryset(self):
        # Exclusively scope to the user's validated workspace
        workspace = self.request.workspace_membership.workspace
        return ContentSource.objects.filter(workspace=workspace).order_by('-created_at')

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .tasks import start_generation_chain
import traceback
import sys

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, HasWorkspaceRole])
def generate_post(request):
    membership = getattr(request, 'workspace_membership', None)
    if not membership:
        return Response({'error': 'You do not have permission to generate posts.'}, status=403)

    if membership.custom_role:
        from workspaces.permissions import has_workspace_permission
        if not has_workspace_permission(request.user, membership.workspace, 'SOCIAL_MEDIA_MANAGER', 'POSTS', 'CREATE'):
            return Response({'error': 'Permission denied: Requires SOCIAL_MEDIA_MANAGER.POSTS.CREATE'}, status=403)
    else:
        if membership.role not in ['OWNER', 'ADMIN', 'MEMBER']:
            return Response({'error': 'You do not have permission to generate posts.'}, status=403)


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
            workspace=membership.workspace,
            input_type=input_type,
            input_data=input_data,
            user_image_prompt=user_image_prompt,
            generate_image=generate_image,
            status='Pending'
        )
        
        start_generation_chain.delay(task.id, platforms)
        
        return Response({'task_id': str(task.id), 'status': 'Pending'})
        
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        tb = traceback.extract_tb(exc_traceback)
        last_call = tb[-1]
        error_msg = f"Error in {last_call.filename} at line {last_call.lineno}: {str(e)}"
        return Response({'error': error_msg}, status=500)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def poll_task(request, task_id):
    try:
        task = GenerationTask.objects.get(id=task_id)
        
        # Security: legacy tasks (workspace=None) should not be exposed via API
        if not task.workspace:
            return Response({'error': 'Task not found'}, status=404)
            
        # Security: IDOR check against active workspace membership
        user_workspace = getattr(request.user, 'current_workspace', None)
        if not user_workspace or task.workspace_id != user_workspace.id:
            return Response({'error': 'Task not found'}, status=404)
            
        from workspaces.models import WorkspaceMembership
        try:
            membership = WorkspaceMembership.objects.get(user=request.user, workspace=task.workspace)
            if membership.status != 'ACTIVE':
                return Response({'error': 'Task not found'}, status=404)
        except WorkspaceMembership.DoesNotExist:
            return Response({'error': 'Task not found'}, status=404)

        return Response({
            'task_id': str(task.id),
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
