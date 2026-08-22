from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from workspaces.models import PlatformAccount, User, Workspace
from .models import SocialPost, GeneratedImage
from .tasks import publish_to_instagram_task, publish_to_facebook_task, publish_to_twitter_task
import requests
import json
from django.conf import settings
from django.shortcuts import redirect

class PublishPostView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        content = request.data.get('content')
        platform_account_id = request.data.get('platform_account_id')
        platform = request.data.get('platform')
        image_url = request.data.get('image_url')
        scheduled_for_str = request.data.get('scheduled_for')

        if not content:
            return Response(
                {"error": "'content' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not platform_account_id and not platform:
            return Response(
                {"error": "Either 'platform_account_id' or 'platform' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ensure the platform account exists and belongs to the user's workspace
        user = request.user
        
        if platform_account_id:
            account = get_object_or_404(PlatformAccount, id=platform_account_id, workspace=user.current_workspace)
        else:
            # Map frontend string 'facebook' to DB enum 'FACEBOOK_PAGE'
            db_platform = platform.upper()
            if db_platform == 'FACEBOOK':
                db_platform = 'FACEBOOK_PAGE'
                
            account = PlatformAccount.objects.filter(
                workspace=user.current_workspace, 
                platform=db_platform
            ).first()
            
            if not account:
                return Response(
                    {"error": f"No connected account found for platform '{platform}'."},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Try to find the pre-generated image
        gen_image = None
        if image_url:
            # We strip the media url prefix to search by the file field
            relative_path = image_url.replace('/media/', '')
            gen_image = GeneratedImage.objects.filter(image=relative_path).first()

        from django.utils.dateparse import parse_datetime
        from django.utils import timezone
        
        scheduled_time = None
        if scheduled_for_str:
            scheduled_time = parse_datetime(scheduled_for_str)

        # Create the post in PENDING or SCHEDULED status
        initial_status = 'SCHEDULED' if scheduled_time and scheduled_time > timezone.now() else 'PENDING'
        
        post = SocialPost.objects.create(
            platform_account=account,
            content=content,
            image=gen_image,
            status=initial_status,
            scheduled_for=scheduled_time
        )

        if initial_status == 'PENDING':
            # Trigger the celery task asynchronously immediately
            if account.platform == 'INSTAGRAM':
                publish_to_instagram_task.delay(post.id)
            elif account.platform == 'FACEBOOK_PAGE':
                publish_to_facebook_task.delay(post.id)
            elif account.platform == 'TWITTER':
                publish_to_twitter_task.delay(post.id)
            else:
                post.status = 'FAILED'
                post.error_message = f"Unsupported platform: {account.platform}"
                post.save()
                return Response({"error": f"Unsupported platform: {account.platform}"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "message": "Post creation started.",
                "post_id": post.id,
                "status": post.status
            },
            status=status.HTTP_202_ACCEPTED
        )

class PublishPostStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, post_id):
        post = get_object_or_404(SocialPost, id=post_id)
        return Response({
            "status": post.status,
            "error_message": post.error_message,
            "platform_post_id": post.platform_post_id
        })


class FacebookLoginView(APIView):
    """
    Redirects the user to the Facebook OAuth login page.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        app_id = getattr(settings, 'FACEBOOK_APP_ID', '')
        redirect_uri = getattr(settings, 'FACEBOOK_REDIRECT_URI', 'http://localhost:8000/api/platform/facebook/callback/')
        
        user = request.user
        fb_auth_url = (
            f"https://www.facebook.com/v20.0/dialog/oauth?"
            f"client_id={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"scope=pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,business_management&"
            f"state={user.id}"  # Pass the user id in state to link it back later
        )
        return Response({'url': fb_auth_url})

class FacebookCallbackView(APIView):
    """
    Handles the OAuth callback from Facebook.
    """
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')  # This is the user id
        
        if not code:
            return redirect('http://localhost:5173/platforms?error=missing_code')
            
        app_id = getattr(settings, 'FACEBOOK_APP_ID', '')
        app_secret = getattr(settings, 'FACEBOOK_APP_SECRET', '')
        redirect_uri = getattr(settings, 'FACEBOOK_REDIRECT_URI', 'http://localhost:8000/api/platform/facebook/callback/')
        
        # 1. Exchange code for access token
        token_url = (
            f"https://graph.facebook.com/v20.0/oauth/access_token?"
            f"client_id={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"client_secret={app_secret}&"
            f"code={code}"
        )
        token_res = requests.get(token_url).json()
        access_token = token_res.get('access_token')
        
        if not access_token:
            return redirect('http://localhost:5173/platforms?error=token_failed')
            
        # [DEBUG] Inspect the token to see what scopes Facebook actually granted
        debug_url = f"https://graph.facebook.com/v20.0/debug_token?input_token={access_token}&access_token={app_id}|{app_secret}"
        debug_res = requests.get(debug_url).json()
        scopes_granted = debug_res.get('data', {}).get('scopes', [])
        print("TOKEN DEBUG INFO (SCOPES GRANTED):", scopes_granted)
        
        # 2. Get user's pages
        pages_url = f"https://graph.facebook.com/v20.0/me/accounts?access_token={access_token}"
        pages_res = requests.get(pages_url).json()
        
        print("FACEBOOK PAGES RESPONSE:", pages_res)
        
        if 'data' not in pages_res or len(pages_res['data']) == 0:
            return redirect('http://localhost:5173/platforms?error=no_pages')
            
        # For simplicity, we just link the first page found.
        # In a real dashboard, we might return a list and ask the user to select.
        page = pages_res['data'][0]
        page_id = page['id']
        page_token = page['access_token']
        page_name = page['name']
        
        # Find the user's workspace
        # Note: in real production we would get the user from `state` or request.user if session auth
        user = User.objects.get(id=state)
        if not user.current_workspace:
            from workspaces.models import Workspace
            user.current_workspace = Workspace.objects.first()
            user.save()
        workspace = user.current_workspace
        
        account, created = PlatformAccount.objects.update_or_create(
            workspace=workspace,
            platform='FACEBOOK_PAGE',
            account_id=page_id,
            defaults={
                'access_token': page_token,
                'name': page_name
            }
        )
        
        # 3. Check for linked Instagram Business Account
        ig_url = f"https://graph.facebook.com/v20.0/{page_id}?fields=instagram_business_account&access_token={page_token}"
        ig_res = requests.get(ig_url).json()
        ig_account_id = ig_res.get('instagram_business_account', {}).get('id')
        
        ig_message = ""
        if ig_account_id:
            # Fetch IG account details
            ig_details_url = f"https://graph.facebook.com/v20.0/{ig_account_id}?fields=username,name&access_token={page_token}"
            ig_details = requests.get(ig_details_url).json()
            ig_username = ig_details.get('username', f"IG_{ig_account_id}")
            
            PlatformAccount.objects.update_or_create(
                workspace=workspace,
                platform='INSTAGRAM',
                account_id=ig_account_id,
                defaults={
                    'access_token': page_token, # Uses the same page token
                    'name': ig_username
                }
            )
            ig_message = " and linked Instagram account"
        
        return redirect('http://localhost:5173/platforms?success=true')

class ConnectManualFacebookView(APIView):
    """
    Plug and play endpoint to manually connect a Facebook page using a generated token.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        page_id = request.data.get('page_id')
        access_token = request.data.get('access_token')
        page_name = request.data.get('page_name', 'Manual Facebook Page')
        
        if not page_id or not access_token:
            return Response({"error": "Both 'page_id' and 'access_token' are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = request.user
        account, created = PlatformAccount.objects.update_or_create(
            workspace=user.current_workspace,
            platform='FACEBOOK_PAGE',
            account_id=page_id,
            defaults={
                'access_token': access_token,
                'name': page_name
            }
        )
        
        return Response({
            "message": "Successfully connected Facebook Page manually!",
            "platform_account_id": account.id
        })

class GetConnectedPlatformsView(APIView):
    """
    Returns a list of all currently connected platforms for the workspace.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        accounts = PlatformAccount.objects.filter(workspace=user.current_workspace)
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "platform": acc.platform,
                "name": acc.name,
                "account_id": acc.account_id
            })
        return Response({"connected_platforms": data})

class DisconnectPlatformView(APIView):
    """
    Disconnects a specific platform for the user's workspace.
    """
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, platform_name):
        user = request.user
        db_platform = platform_name.upper()
        if db_platform == 'FACEBOOK':
            db_platform = 'FACEBOOK_PAGE'
            
        deleted_count, _ = PlatformAccount.objects.filter(
            workspace=user.current_workspace,
            platform=db_platform
        ).delete()

        if deleted_count > 0:
            return Response({"message": f"Successfully disconnected {platform_name}."})
        return Response({"error": "Platform connection not found."}, status=status.HTTP_404_NOT_FOUND)


class ConnectManualTwitterView(APIView):
    """
    Plug and play endpoint to manually connect Twitter using developer keys.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        api_key = request.data.get('api_key')
        api_secret = request.data.get('api_secret')
        access_token = request.data.get('access_token')
        access_token_secret = request.data.get('access_token_secret')
        account_name = request.data.get('account_name', 'Manual Twitter Account')
        
        if not all([api_key, api_secret, access_token, access_token_secret]):
            return Response({"error": "All 4 Twitter keys are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Store them securely. For simplicity in this demo, we store as a JSON string in access_token field.
        tokens = {
            "api_key": api_key,
            "api_secret": api_secret,
            "access_token": access_token,
            "access_token_secret": access_token_secret
        }
        
        user = request.user
        account, created = PlatformAccount.objects.update_or_create(
            workspace=user.current_workspace,
            platform='TWITTER',
            # Using api_key as the account_id for unique identification here
            account_id=api_key,
            defaults={
                'access_token': json.dumps(tokens),
                'name': account_name
            }
        )
        
        return Response({
            "message": "Successfully connected Twitter manually!",
            "platform_account_id": account.id
        })

class TwitterLoginView(APIView):
    """Initiates Twitter OAuth 2.0 PKCE Flow"""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        client_id = getattr(settings, 'TWITTER_CLIENT_ID', '')
        redirect_uri = getattr(settings, 'TWITTER_REDIRECT_URI', 'http://localhost:8000/api/platform/twitter/callback/')
        
        import tweepy
        from django.core.cache import cache
        from urllib.parse import urlparse, parse_qs
        
        oauth2_user_handler = tweepy.OAuth2UserHandler(
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=["tweet.read", "tweet.write", "users.read", "offline.access"],
            client_secret=getattr(settings, 'TWITTER_CLIENT_SECRET', '')
        )
        
        auth_url = oauth2_user_handler.get_authorization_url()
        
        # Extract the state and code_verifier to store in cache instead of the whole unpicklable session object
        parsed = urlparse(auth_url)
        state = parse_qs(parsed.query).get('state', [None])[0]
        code_verifier = getattr(oauth2_user_handler._client, 'code_verifier', None)
        
        if state and code_verifier:
            new_state = f"{state}___{request.user.id}"
            auth_url = auth_url.replace(f"state={state}", f"state={new_state}")
            cache.set(f'twitter_oauth_{new_state}', code_verifier, timeout=3600)
            
        return Response({'url': auth_url})

class TwitterCallbackView(APIView):
    """Handles standard Twitter OAuth 2.0 PKCE Callback"""
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')
        
        if not code or not state:
            return redirect('http://localhost:5173/platforms?error=missing_code')
            
        import tweepy
        from django.core.cache import cache
        
        client_id = getattr(settings, 'TWITTER_CLIENT_ID', '')
        redirect_uri = getattr(settings, 'TWITTER_REDIRECT_URI', 'http://localhost:8000/api/platform/twitter/callback/')
        
        # Retrieve the PKCE code_verifier string from the cache
        code_verifier = cache.get(f'twitter_oauth_{state}')
        if not code_verifier:
            return redirect('http://localhost:5173/platforms?error=session_expired')
        
        oauth2_user_handler = tweepy.OAuth2UserHandler(
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=["tweet.read", "tweet.write", "users.read", "offline.access"],
            client_secret=getattr(settings, 'TWITTER_CLIENT_SECRET', '')
        )
        
        # Manually inject the code_verifier back into the handler's internal client
        oauth2_user_handler._client.code_verifier = code_verifier
        
        try:
            # Fetch the token using the injected code_verifier
            access_token = oauth2_user_handler.fetch_token(request.build_absolute_uri())
            
            # Fetch user details using the access token
            # We must pass user_auth=False so Tweepy uses the bearer_token (OAuth2) instead of expecting OAuth1 keys
            client = tweepy.Client(bearer_token=access_token['access_token'])
            me = client.get_me(user_auth=False)
            twitter_id = str(me.data.id)
            twitter_username = me.data.username
            
            user_id = state.split('___')[-1] if '___' in state else None
            if not user_id:
                return redirect('http://localhost:5173/platforms?error=invalid_state')
                
            user = User.objects.get(id=user_id)
            if not user.current_workspace:
                from workspaces.models import Workspace
                user.current_workspace = Workspace.objects.first()
                user.save()
                
            account, created = PlatformAccount.objects.update_or_create(
                workspace=user.current_workspace,
                platform='TWITTER',
                account_id=twitter_id,
                defaults={
                    'access_token': access_token['access_token'],
                    'name': f"@{twitter_username}"
                }
            )
            return redirect('http://localhost:5173/platforms?success=true')
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return redirect('http://localhost:5173/platforms?error=twitter_connect_failed')

class ScheduledPostsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.current_workspace:
            return Response({"error": "No active workspace"}, status=status.HTTP_400_BAD_REQUEST)
            
        posts = SocialPost.objects.filter(
            platform_account__workspace=user.current_workspace,
            status='SCHEDULED'
        ).order_by('scheduled_for')
        
        data = []
        for p in posts:
            data.append({
                "id": str(p.id),
                "platform": p.platform_account.platform,
                "account_name": p.platform_account.name,
                "content": p.content,
                "scheduled_for": p.scheduled_for.isoformat() if p.scheduled_for else None,
                "image_url": p.image.image.url if p.image and p.image.image else None
            })
            
        return Response(data, status=status.HTTP_200_OK)

class ScheduledPostDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_post(self, request, post_id):
        user = request.user
        return get_object_or_404(
            SocialPost, 
            id=post_id, 
            platform_account__workspace=user.current_workspace,
            status='SCHEDULED'
        )

    def put(self, request, post_id):
        post = self.get_post(request, post_id)
        
        content = request.data.get('content')
        scheduled_for_str = request.data.get('scheduled_for')
        
        if content is not None:
            post.content = content
            
        if scheduled_for_str is not None:
            from django.utils.dateparse import parse_datetime
            from django.utils import timezone
            dt = parse_datetime(scheduled_for_str)
            if dt:
                post.scheduled_for = dt
                
        post.save()
        
        return Response({
            "id": str(post.id),
            "platform": post.platform_account.platform,
            "content": post.content,
            "scheduled_for": post.scheduled_for.isoformat() if post.scheduled_for else None
        }, status=status.HTTP_200_OK)

    def delete(self, request, post_id):
        post = self.get_post(request, post_id)
        post.delete()
        return Response({"message": "Scheduled post cancelled successfully."}, status=status.HTTP_200_OK)



from workspaces.models import WhatsAppIntegration
from core.encryption import encrypt_token, decrypt_token
from .providers.whatsapp import MetaWhatsAppProvider

class MetaWhatsAppConnectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.current_workspace:
            return Response({"error": "No active workspace"}, status=status.HTTP_400_BAD_REQUEST)

        phone_number_id = request.data.get("phone_number_id")
        business_account_id = request.data.get("business_account_id")
        system_user_token = request.data.get("system_user_token")

        if not all([phone_number_id, business_account_id, system_user_token]):
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate with Meta before saving
        provider = MetaWhatsAppProvider(phone_number_id=phone_number_id, access_token=system_user_token)
        if not provider.validate_connection():
            return Response({"error": "Failed to validate credentials with Meta API"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            encrypted_token = encrypt_token(system_user_token)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        integration, created = WhatsAppIntegration.objects.update_or_create(
            workspace=user.current_workspace,
            defaults={
                "phone_number_id": phone_number_id,
                "business_account_id": business_account_id,
                "encrypted_system_user_token": encrypted_token,
                "is_active": True
            }
        )

        return Response({"message": "WhatsApp connected successfully."}, status=status.HTTP_200_OK)

class MetaWhatsAppTestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.current_workspace:
            return Response({"error": "No active workspace"}, status=status.HTTP_400_BAD_REQUEST)

        integration = WhatsAppIntegration.objects.filter(workspace=user.current_workspace).first()
        if not integration:
            return Response({"error": "WhatsApp integration not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            system_user_token = decrypt_token(integration.encrypted_system_user_token)
        except ValueError as e:
            return Response({"error": "Failed to decrypt token. Please reconnect."}, status=status.HTTP_400_BAD_REQUEST)

        provider = MetaWhatsAppProvider(phone_number_id=integration.phone_number_id, access_token=system_user_token)
        if provider.validate_connection():
            integration.is_active = True
            integration.save(update_fields=['is_active'])
            return Response({"message": "Connection is valid"}, status=status.HTTP_200_OK)
        else:
            integration.is_active = False
            integration.save(update_fields=['is_active'])
            return Response({"error": "Connection is invalid"}, status=status.HTTP_400_BAD_REQUEST)

class MetaWhatsAppStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.current_workspace:
            return Response({"error": "No active workspace"}, status=status.HTTP_400_BAD_REQUEST)

        integration = WhatsAppIntegration.objects.filter(workspace=user.current_workspace).first()
        if not integration:
            return Response({"is_connected": False}, status=status.HTTP_200_OK)

        return Response({
            "is_connected": True,
            "is_active": integration.is_active,
            "phone_number_id": integration.phone_number_id,
            "business_account_id": integration.business_account_id
        }, status=status.HTTP_200_OK)

class MetaWhatsAppDisconnectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        if not user.current_workspace:
            return Response({"error": "No active workspace"}, status=status.HTTP_400_BAD_REQUEST)

        deleted_count, _ = WhatsAppIntegration.objects.filter(workspace=user.current_workspace).delete()
        if deleted_count > 0:
            return Response({"message": "WhatsApp integration disconnected"}, status=status.HTTP_200_OK)
        return Response({"error": "WhatsApp integration not found"}, status=status.HTTP_404_NOT_FOUND)


