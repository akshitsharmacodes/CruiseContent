from celery import shared_task
from django.core.files.base import ContentFile
from .models import SocialPost, GeneratedImage
from workspaces.models import PlatformAccount
from .services import AIServiceFactory
from .instagram import InstagramAdapter
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def publish_to_instagram_task(self, post_id: str):
    """
    Celery task to generate an image and publish a post to Instagram asynchronously.
    """
    try:
        logger.info(f"========== STARTING INSTAGRAM PUBLISH {post_id} ==========")
        post = SocialPost.objects.get(id=post_id)
        account = post.platform_account
        workspace = account.workspace
        
        logger.info(f"[Step 1] Verifying workspace and API keys for post {post_id}")
        
        if not post.image:
            error_msg = f"Instagram requires an image, but none was provided for post {post.id}."
            logger.error(error_msg)
            post.status = 'FAILED'
            post.error_message = error_msg
            post.save()
            return
            
        logger.info(f"[Step 2] Found existing pre-generated image for post {post.id}: {post.image.image.url}")
        
        # Step 3: Publish to Instagram
        logger.info(f"[Step 3] Publishing post {post.id} to Instagram via Adapter")
        
        # We need a publicly accessible URL for Instagram Graph API to download it.
        # Since localhost is not public, we reconstruct the pollinations.ai URL using the saved prompt.
        import urllib.parse
        encoded_prompt = urllib.parse.quote(post.image.prompt_used)
        public_image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
        
        logger.info(f"  -> Using Public Image URL: {public_image_url}")
        
        adapter = InstagramAdapter(
            access_token=account.access_token,
            instagram_account_id=account.account_id
        )
        
        logger.info("  -> Calling Instagram API to publish post...")
        platform_post_id = adapter.publish(image_url=public_image_url, caption=post.content)
        logger.info(f"  -> Successfully published! Platform Post ID: {platform_post_id}")
        
        post.platform_post_id = platform_post_id
        post.status = 'SUCCESS'
        post.save()
        logger.info(f"========== COMPLETED INSTAGRAM PUBLISH {post_id} ==========")
        
    except Exception as e:
        logger.error(f"[ERROR in Instagram Publish task for {post_id}]: {str(e)}", exc_info=True)
        post.status = 'FAILED'
        post.error_message = str(e)
        post.save()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def publish_to_facebook_task(self, post_id: str):
    """
    Celery task to publish a post to Facebook asynchronously.
    """
    from .facebook import FacebookAdapter
    
    try:
        logger.info(f"========== STARTING FACEBOOK PUBLISH {post_id} ==========")
        post = SocialPost.objects.get(id=post_id)
        account = post.platform_account
        workspace = account.workspace
        
        logger.info(f"[Step 1] Verifying workspace and AI service for post {post_id}")
        if not post.image:
            logger.info(f"[Step 2] No pre-generated image found for post {post.id}. Publishing text-only post.")
            image_path = None
        else:
            logger.info(f"[Step 2] Found existing pre-generated image for post {post.id}: {post.image.image.path}")
            image_path = post.image.image.path
            
        # Step 3: Publish to Facebook
        logger.info(f"[Step 3] Publishing post {post.id} to Facebook via Adapter")
        if image_path:
            logger.info(f"  -> Using Image Path: {image_path}")
        
        adapter = FacebookAdapter(
            access_token=account.access_token,
            page_id=account.account_id
        )
        
        logger.info("  -> Calling Facebook API to publish post...")
        platform_post_id = adapter.publish(caption=post.content, image_path=image_path)
        logger.info(f"  -> Successfully published! Platform Post ID: {platform_post_id}")
        
        post.platform_post_id = platform_post_id
        post.status = 'SUCCESS'
        post.save()
        logger.info(f"========== COMPLETED FACEBOOK PUBLISH {post_id} ==========")
        
    except Exception as e:
        logger.error(f"[ERROR in Facebook Publish task for {post_id}]: {str(e)}", exc_info=True)
        post.status = 'FAILED'
        post.error_message = str(e)
        post.save()

@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def publish_to_twitter_task(self, post_id: str):
    """
    Celery task to publish a post to Twitter asynchronously.
    """
    from .twitter import TwitterAdapter
    import json
    
    try:
        logger.info(f"========== STARTING TWITTER PUBLISH {post_id} ==========")
        post = SocialPost.objects.get(id=post_id)
        account = post.platform_account
        workspace = account.workspace
        
        logger.info(f"[Step 1] Verifying workspace and AI service for post {post_id}")
        if not post.image:
            logger.info(f"[Step 2] No pre-generated image found for post {post.id}. Publishing text-only post.")
            image_path = None
        else:
            logger.info(f"[Step 2] Found existing pre-generated image for post {post.id}: {post.image.image.url}")
            image_path = post.image.image.path
            
        # Step 3: Publish to Twitter
        logger.info(f"[Step 3] Publishing post {post.id} to Twitter via Adapter")
        if image_path:
            logger.info(f"  -> Using Image Path: {image_path}")
        
        # The access_token field might store all 4 keys as a JSON string (manual) or a simple bearer token (OAuth2)
        try:
            tokens = json.loads(account.access_token)
            adapter = TwitterAdapter(
                api_key=tokens.get('api_key'),
                api_secret=tokens.get('api_secret'),
                access_token=tokens.get('access_token'),
                access_token_secret=tokens.get('access_token_secret')
            )
        except json.JSONDecodeError:
            # It's an OAuth2 PKCE Bearer token
            adapter = TwitterAdapter(access_token=account.access_token)
        
        logger.info("  -> Calling Twitter API to publish post...")
        result = adapter.publish_post(text=post.content, image_path=image_path)
        
        if result.get('success'):
            logger.info(f"  -> Successfully published! Platform Post ID: {result.get('platform_post_id')}")
            post.platform_post_id = result.get('platform_post_id')
            post.status = 'SUCCESS'
        else:
            logger.error(f"  -> Failed to publish: {result.get('error')}")
            post.status = 'FAILED'
            post.error_message = result.get('error')
            
        post.save()
        logger.info(f"========== COMPLETED TWITTER PUBLISH {post_id} ==========")
        
    except Exception as e:
        logger.error(f"[ERROR in Twitter Publish task for {post_id}]: {str(e)}", exc_info=True)
        post.status = 'FAILED'
        post.error_message = str(e)
        post.save()

@shared_task(bind=True, max_retries=3)
def publish_to_whatsapp_task(self, post_id: str):
    from workspaces.models import WhatsAppIntegration
    from core.encryption import decrypt_token
    from .providers.whatsapp import MetaWhatsAppProvider
    from django.conf import settings
    
    try:
        logger.info(f"========== STARTING WHATSAPP PUBLISH {post_id} ==========")
        post = SocialPost.objects.get(id=post_id)
        workspace = post.platform_account.workspace
        
        integration = WhatsAppIntegration.objects.filter(workspace=workspace).first()
        
        if not integration:
            post.status = 'FAILED'
            post.error_message = "WhatsApp integration is not connected for this workspace."
            post.save()
            logger.error(f"WhatsApp publish failed: {post.error_message}")
            return
            
        if not integration.is_active:
            post.status = 'FAILED'
            post.error_message = "WhatsApp integration is disconnected. Please reconnect."
            post.save()
            logger.error(f"WhatsApp publish failed: {post.error_message}")
            return
            
        try:
            system_user_token = decrypt_token(integration.encrypted_system_user_token)
        except Exception:
            post.status = 'FAILED'
            post.error_message = "Failed to decrypt WhatsApp credentials. Please reconnect."
            post.save()
            logger.error("WhatsApp publish failed: Decryption error.")
            return
            
        provider = MetaWhatsAppProvider(
            phone_number_id=integration.phone_number_id, 
            access_token=system_user_token
        )
        
        media_url = None
        if post.image:
            media_url = f"{settings.SITE_URL}{post.image.image.url}" if hasattr(settings, 'SITE_URL') else f"http://localhost:8000{post.image.image.url}"
            
        target_number = getattr(post, 'target_recipient', None)
        if not target_number:
            post.status = 'FAILED'
            post.error_message = "No legitimate recipient exists for this WhatsApp post. Please configure a recipient."
            post.save()
            logger.error(f"WhatsApp publish failed: {post.error_message}")
            return
        
        if media_url:
            result = provider.send_media(target_number, post.content, media_url)
        else:
            result = provider.send_text(target_number, post.content)
        
        if result.get("success"):
            post.status = 'SUCCESS'
            post.platform_post_id = result.get("data", {}).get("messages", [{}])[0].get("id", "")
            post.save()
            logger.info(f"========== COMPLETED WHATSAPP PUBLISH {post_id} ==========")
        else:
            post.status = 'FAILED'
            post.error_message = "Meta API publishing failed. Please check your credentials and configuration."
            post.save()
            
            status_code = result.get("status_code")
            is_transient = status_code in [408, 429] or (status_code and status_code >= 500) or not status_code
            
            if is_transient:
                logger.warning(f"Transient Meta API failure (HTTP {status_code}). Retrying...")
                raise self.retry(countdown=2 ** self.request.retries)
            else:
                logger.error(f"Permanent Meta API failure (HTTP {status_code}). Not retrying.")
                return
            
    except Exception as e:
        # Ignore Retry exceptions so they propagate normally to Celery
        from celery.exceptions import Retry
        if isinstance(e, Retry):
            raise
            
        error_str = str(e)
        if 'system_user_token' in locals() and system_user_token and system_user_token in error_str:
            error_str = error_str.replace(system_user_token, "[REDACTED_TOKEN]")
            
        logger.error(f"[ERROR in WhatsApp Publish task for {post_id}]: {error_str}", exc_info=True)
        if not hasattr(post, 'status') or post.status != 'FAILED':
            post.status = 'FAILED'
            post.error_message = error_str
            post.save()
            
        # Unhandled exceptions could be transient (e.g. DB goes away)
        raise self.retry(exc=e, countdown=2 ** self.request.retries)

@shared_task
def process_scheduled_posts():
    """
    Celery Beat task to sweep for scheduled posts that are due.
    """
    from django.utils import timezone
    from .models import SocialPost

    now = timezone.now()
    logger.info(f"========== RUNNING SCHEDULED POSTS SWEEP AT {now} ==========")
    
    # Find posts that are scheduled and the scheduled time has passed or is now
    due_posts = SocialPost.objects.filter(status='SCHEDULED', scheduled_for__lte=now)
    
    count = due_posts.count()
    if count == 0:
        logger.info("No scheduled posts due at this time.")
        return

    logger.info(f"Found {count} scheduled post(s) to process.")
    
    for post in due_posts:
        # Mark as PENDING immediately so another concurrent sweep doesn't pick it up
        post.status = 'PENDING'
        post.save(update_fields=['status'])
        
        platform = post.platform_account.platform
        
        if platform == 'INSTAGRAM':
            publish_to_instagram_task.delay(post.id)
        elif platform == 'FACEBOOK_PAGE':
            publish_to_facebook_task.delay(post.id)
        elif platform == 'TWITTER':
            publish_to_twitter_task.delay(post.id)
        elif platform == 'WHATSAPP':
            publish_to_whatsapp_task.delay(post.id)
        else:
            logger.error(f"Unsupported platform {platform} for scheduled post {post.id}")
            post.status = 'FAILED'
            post.error_message = f"Unsupported platform: {platform}"
            post.save(update_fields=['status', 'error_message'])
            
    logger.info("========== COMPLETED SCHEDULED POSTS SWEEP ==========")

