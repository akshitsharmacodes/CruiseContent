from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from workspaces.models import PlatformAccount, User
from .models import SocialPost, GeneratedImage
from .tasks import publish_to_instagram_task, publish_to_facebook_task, publish_to_twitter_task
import requests
import json
from django.conf import settings
from django.shortcuts import redirect

class PublishPostView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        content = request.data.get('content')
        platform_account_id = request.data.get('platform_account_id')
        platform = request.data.get('platform')
        image_url = request.data.get('image_url')

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
        user = User.objects.first()
        
        if platform_account_id:
            account = get_object_or_404(PlatformAccount, id=platform_account_id, workspace=user.workspace)
        else:
            # Map frontend string 'facebook' to DB enum 'FACEBOOK_PAGE'
            db_platform = platform.upper()
            if db_platform == 'FACEBOOK':
                db_platform = 'FACEBOOK_PAGE'
                
            account = PlatformAccount.objects.filter(
                workspace=user.workspace, 
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

        # Create the post in PENDING status
        post = SocialPost.objects.create(
            platform_account=account,
            content=content,
            image=gen_image,
            status='PENDING'
        )

        # Trigger the celery task asynchronously based on platform
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

class FacebookLoginView(APIView):
    """
    Redirects the user to the Facebook OAuth login page.
    """
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        app_id = getattr(settings, 'FACEBOOK_APP_ID', '')
        redirect_uri = getattr(settings, 'FACEBOOK_REDIRECT_URI', 'http://localhost:8000/api/platform/facebook/callback/')
        
        user = User.objects.first()
        fb_auth_url = (
            f"https://www.facebook.com/v20.0/dialog/oauth?"
            f"client_id={app_id}&"
            f"redirect_uri={redirect_uri}&"
            f"scope=pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,business_management&"
            f"state={user.id}"  # Pass the user id in state to link it back later
        )
        return redirect(fb_auth_url)

class FacebookCallbackView(APIView):
    """
    Handles the OAuth callback from Facebook.
    """
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')  # This is the user id
        
        if not code:
            return Response({"error": "Missing code from Facebook"}, status=status.HTTP_400_BAD_REQUEST)
            
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
            return Response({"error": "Failed to retrieve access token", "details": token_res}, status=status.HTTP_400_BAD_REQUEST)
            
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
            return Response({
                "error": "No Facebook Pages found for this user", 
                "raw_response": pages_res,
                "scopes_granted_by_facebook": scopes_granted
            }, status=status.HTTP_404_NOT_FOUND)
            
        # For simplicity, we just link the first page found.
        # In a real dashboard, we might return a list and ask the user to select.
        page = pages_res['data'][0]
        page_id = page['id']
        page_token = page['access_token']
        page_name = page['name']
        
        # Find the user's workspace
        # Note: in real production we would get the user from `state` or request.user if session auth
        user = User.objects.get(id=state)
        if not user.workspace:
            from workspaces.models import Workspace
            user.workspace = Workspace.objects.first()
            user.save()
        workspace = user.workspace
        
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
        
        return Response({
            "message": f"Successfully connected Facebook Page{ig_message}!",
            "page_name": page_name,
            "account_id": page_id
        })

class ConnectManualFacebookView(APIView):
    """
    Plug and play endpoint to manually connect a Facebook page using a generated token.
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        page_id = request.data.get('page_id')
        access_token = request.data.get('access_token')
        page_name = request.data.get('page_name', 'Manual Facebook Page')
        
        if not page_id or not access_token:
            return Response({"error": "Both 'page_id' and 'access_token' are required"}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.first()
        account, created = PlatformAccount.objects.update_or_create(
            workspace=user.workspace,
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
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        user = User.objects.first()
        accounts = PlatformAccount.objects.filter(workspace=user.workspace)
        data = []
        for acc in accounts:
            data.append({
                "id": acc.id,
                "platform": acc.platform,
                "name": acc.name,
                "account_id": acc.account_id
            })
        return Response({"connected_platforms": data})

class ConnectManualTwitterView(APIView):
    """
    Plug and play endpoint to manually connect Twitter using developer keys.
    """
    permission_classes = [permissions.AllowAny]
    
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
        
        user = User.objects.first()
        account, created = PlatformAccount.objects.update_or_create(
            workspace=user.workspace,
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
    permission_classes = [permissions.AllowAny]
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
            cache.set(f'twitter_oauth_{state}', code_verifier, timeout=3600)
            
        return redirect(auth_url)

class TwitterCallbackView(APIView):
    """Handles standard Twitter OAuth 2.0 PKCE Callback"""
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')
        
        if not code or not state:
            return Response({"error": "Missing authorization code or state"}, status=status.HTTP_400_BAD_REQUEST)
            
        import tweepy
        from django.core.cache import cache
        
        client_id = getattr(settings, 'TWITTER_CLIENT_ID', '')
        redirect_uri = getattr(settings, 'TWITTER_REDIRECT_URI', 'http://localhost:8000/api/platform/twitter/callback/')
        
        # Retrieve the PKCE code_verifier string from the cache
        code_verifier = cache.get(f'twitter_oauth_{state}')
        if not code_verifier:
            return Response({"error": "OAuth session expired or invalid state. Please try again."}, status=status.HTTP_400_BAD_REQUEST)
        
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
            
            user = User.objects.first()
            if not user.workspace:
                from workspaces.models import Workspace
                user.workspace = Workspace.objects.first()
                user.save()
                
            account, created = PlatformAccount.objects.update_or_create(
                workspace=user.workspace,
                platform='TWITTER',
                account_id=twitter_id,
                defaults={
                    'access_token': access_token['access_token'],
                    'name': f"@{twitter_username}"
                }
            )
            return Response({
                "message": "Successfully connected Twitter!",
                "account_name": twitter_username
            })
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
