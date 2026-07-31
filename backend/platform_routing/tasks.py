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
        
        # We need the absolute URL of the image for Instagram Graph API to download it.
        image_url = post.image.image.url
        logger.info(f"  -> Using Image URL: {image_url}")
        
        adapter = InstagramAdapter(
            access_token=account.access_token,
            instagram_account_id=account.account_id
        )
        
        logger.info("  -> Calling Instagram API to publish post...")
        platform_post_id = adapter.publish(image_url=image_url, caption=post.content)
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
            image_url = None
        else:
            logger.info(f"[Step 2] Found existing pre-generated image for post {post.id}: {post.image.image.url}")
            image_url = post.image.image.url
            
        # Step 3: Publish to Facebook
        logger.info(f"[Step 3] Publishing post {post.id} to Facebook via Adapter")
        if image_url:
            logger.info(f"  -> Using Image URL: {image_url}")
        
        adapter = FacebookAdapter(
            access_token=account.access_token,
            page_id=account.account_id
        )
        
        logger.info("  -> Calling Facebook API to publish post...")
        platform_post_id = adapter.publish(image_url=image_url, caption=post.content)
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
