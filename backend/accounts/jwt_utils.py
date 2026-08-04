import jwt
import datetime
from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed

def generate_tokens_for_user(user, profile):
    """Generates a short-lived access token and long-lived refresh token."""
    now = datetime.datetime.utcnow()
    
    access_payload = {
        'user_id': str(user.id),
        'email': user.email,
        'role': profile.role,
        'tier': profile.tier,
        'workspace_id': str(user.current_workspace.id) if user.current_workspace else None,
        'picture': profile.profile_picture,
        'exp': now + datetime.timedelta(days=7),
        'iat': now,
        'type': 'access'
    }
    
    refresh_payload = {
        'user_id': str(user.id),
        'exp': now + datetime.timedelta(days=7),
        'iat': now,
        'type': 'refresh'
    }
    
    secret = getattr(settings, 'JWT_SECRET', 'django-insecure-development-jwt-key-change-me')
    
    access_token = jwt.encode(access_payload, secret, algorithm='HS256')
    refresh_token = jwt.encode(refresh_payload, secret, algorithm='HS256')
    
    return access_token, refresh_token

def decode_token(token, token_type='access'):
    """Decodes a JWT and verifies it."""
    secret = getattr(settings, 'JWT_SECRET', 'django-insecure-development-jwt-key-change-me')
    try:
        payload = jwt.decode(token, secret, algorithms=['HS256'])
        if payload.get('type') != token_type:
            raise AuthenticationFailed('Invalid token type.')
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed('Token has expired.')
    except jwt.InvalidTokenError:
        raise AuthenticationFailed('Invalid token.')
