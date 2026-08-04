import logging
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model
from .jwt_utils import decode_token

logger = logging.getLogger(__name__)

User = get_user_model()

class CustomJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
            
        token = auth_header.split(' ')[1]
        try:
            payload = decode_token(token, token_type='access')
            user_id = payload.get('user_id')
            user = User.objects.get(id=user_id)
            return (user, token)
        except User.DoesNotExist:
            logger.error(f"JWT Auth failed: User {user_id} not found")
            raise AuthenticationFailed('User not found')
        except Exception as e:
            logger.error(f"JWT Auth failed: {str(e)} | Token: {token}")
            raise AuthenticationFailed(str(e))

    def authenticate_header(self, request):
        return 'Bearer'
