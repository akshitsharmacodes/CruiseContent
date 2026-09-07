import requests
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.contrib.auth import get_user_model, authenticate
from .models import ClientProfile
from .jwt_utils import generate_tokens_for_user, decode_token
from .tasks import send_welcome_email

User = get_user_model()


def _set_refresh_cookie(response, refresh_token):
    """Set the HttpOnly refresh token cookie with environment-driven security settings.

    In production (COOKIE_SECURE=True, COOKIE_SAMESITE=None) this produces:
      Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=None
    which is required for cross-origin HTTPS requests from Vercel → Render.
    """
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        httponly=True,
        secure=getattr(settings, 'COOKIE_SECURE', False),
        samesite=getattr(settings, 'COOKIE_SAMESITE', 'Lax'),
        max_age=7 * 24 * 60 * 60,  # 7 days
    )

class GoogleLoginView(APIView):
    """
    Returns the Google OAuth login URL for the frontend to redirect to.
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
        redirect_uri = getattr(settings, 'GOOGLE_REDIRECT_URI', '')
        scope = 'openid email profile'
        url = f"https://accounts.google.com/o/oauth2/v2/auth?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}&access_type=offline"
        return Response({'url': url})


class GoogleCallbackView(APIView):
    """
    Receives the authorization code from the frontend, exchanges it for Google tokens,
    creates/fetches the user, and returns custom JWTs.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get('code')
        if not code:
            return Response({'error': 'Code is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Exchange code for Google tokens
        token_endpoint = "https://oauth2.googleapis.com/token"
        data = {
            'code': code,
            'client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
            'client_secret': getattr(settings, 'GOOGLE_CLIENT_SECRET', ''),
            'redirect_uri': getattr(settings, 'GOOGLE_REDIRECT_URI', ''),
            'grant_type': 'authorization_code'
        }
        
        token_res = requests.post(token_endpoint, data=data)
        if not token_res.ok:
            error_details = token_res.json()
            print("Google Token Error:", error_details)
            return Response({'error': 'Failed to exchange token with Google', 'details': error_details}, status=status.HTTP_400_BAD_REQUEST)
            
        token_data = token_res.json()
        access_token = token_data.get('access_token')

        # Get user info from Google
        user_info_res = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if not user_info_res.ok:
            return Response({'error': 'Failed to get user info from Google'}, status=status.HTTP_400_BAD_REQUEST)
            
        user_info = user_info_res.json()
        email = user_info.get('email')
        picture = user_info.get('picture', '')
        
        if not email:
            return Response({'error': 'Google account has no email'}, status=status.HTTP_400_BAD_REQUEST)

        # Find or create user
        user, created = User.objects.get_or_create(username=email, defaults={'email': email})
        
        if created:
            # Send welcome email asynchronously using Celery
            user_name = user_info.get('name') or email.split('@')[0]
            send_welcome_email.delay(email, user_name)
        
        # Ensure profile exists and update picture
        profile, p_created = ClientProfile.objects.get_or_create(user=user)
        if picture and profile.profile_picture != picture:
            profile.profile_picture = picture
            profile.save()

        # Generate custom JWTs
        access, refresh = generate_tokens_for_user(user, profile)

        response = Response({'access_token': access, 'refresh_token': refresh})
        _set_refresh_cookie(response, refresh)
        return response


class TokenRefreshView(APIView):
    """
    Takes the HttpOnly refresh cookie (or optional request body) and returns a new access token.
    Preserves HttpOnly refresh-token cookie as the primary mechanism.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh_token')
        if not refresh_token:
            return Response({'error': 'No refresh token provided'}, status=status.HTTP_401_UNAUTHORIZED)
            
        try:
            payload = decode_token(refresh_token, token_type='refresh')
            user_id = payload.get('user_id')
            user = User.objects.get(id=user_id)
            if not user.is_active:
                return Response({'error': 'User account is inactive'}, status=status.HTTP_401_UNAUTHORIZED)
            profile, _ = ClientProfile.objects.get_or_create(user=user)
            
            # Generate new tokens
            access, refresh = generate_tokens_for_user(user, profile)

            response = Response({'access_token': access, 'refresh_token': refresh})
            _set_refresh_cookie(response, refresh)
            return response
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    """
    Clears the HttpOnly refresh token cookie to log the user out securely.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        response = Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)
        response.delete_cookie('refresh_token')
        return response

class StandardLoginView(APIView):
    """
    Standard email/password login that issues custom JWTs and sets HttpOnly refresh token.
    Supports case-insensitive email lookup with secure password checking.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Authenticate with email as username
        user = authenticate(username=email, password=password)
        
        # Case-insensitive fallback if exact natural key failed
        if not user:
            candidate = User.objects.filter(email__iexact=email).first() or User.objects.filter(username__iexact=email).first()
            if candidate and candidate.check_password(password) and candidate.is_active:
                user = candidate

        if not user or not user.is_active:
            return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)

        # Ensure profile exists
        profile, _ = ClientProfile.objects.get_or_create(user=user)

        # Generate tokens
        access, refresh = generate_tokens_for_user(user, profile)

        response = Response({'access_token': access, 'refresh_token': refresh})
        _set_refresh_cookie(response, refresh)
        return response


class StandardSignupView(APIView):
    """
    Standard email/password signup.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({'error': 'A user with this email already exists'}, status=status.HTTP_400_BAD_REQUEST)

        # Create user
        user = User.objects.create_user(username=email, email=email, password=password)
        profile, _ = ClientProfile.objects.get_or_create(user=user)
        
        # Optionally send welcome email here too
        user_name = email.split('@')[0]
        send_welcome_email.delay(email, user_name)

        # Generate tokens
        access, refresh = generate_tokens_for_user(user, profile)

        response = Response({'access_token': access, 'refresh_token': refresh})
        _set_refresh_cookie(response, refresh)
        return response

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from .tasks import send_password_reset_email

class PasswordResetRequestView(APIView):
    """
    Accepts an email and sends a password reset link.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = User.objects.filter(email=email).first()
        if user:
            token_generator = PasswordResetTokenGenerator()
            token = token_generator.make_token(user)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Use frontend URL instead of generating a backend URL
            # Note: This should ideally come from settings, hardcoded to standard local frontend for now
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
            reset_url = f"{frontend_url}/reset-password?uid={uidb64}&token={token}"
            
            # Asynchronous email sending
            send_password_reset_email.delay(user.email, reset_url)
            
        # Return success regardless of whether user exists to prevent email enumeration
        return Response({'message': 'If an account exists with this email, a password reset link has been sent.'})


class PasswordResetConfirmView(APIView):
    """
    Accepts token, uidb64, and new_password to reset the password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uidb64')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        
        if not all([uidb64, token, new_password]):
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
            
        if user is not None:
            token_generator = PasswordResetTokenGenerator()
            if token_generator.check_token(user, token):
                user.set_password(new_password)
                user.save()
                return Response({'message': 'Password has been reset successfully.'})
                
        return Response({'error': 'Invalid or expired token'}, status=status.HTTP_400_BAD_REQUEST)
