import tweepy
import logging
from django.conf import settings
import json

logger = logging.getLogger(__name__)

class TwitterAdapter:
    def __init__(self, access_token, api_key=None, api_secret=None, access_token_secret=None):
        self.access_token = access_token
        self.api_key = api_key
        self.api_secret = api_secret
        self.access_token_secret = access_token_secret

    def _get_v1_api(self):
        auth = tweepy.OAuth1UserHandler(
            self.api_key,
            self.api_secret,
            self.access_token,
            self.access_token_secret
        )
        return tweepy.API(auth)

    def _get_v2_client(self):
        if self.api_key and self.api_secret and self.access_token_secret:
            # OAuth 1.0a Manual Keys
            return tweepy.Client(
                consumer_key=self.api_key,
                consumer_secret=self.api_secret,
                access_token=self.access_token,
                access_token_secret=self.access_token_secret
            )
        else:
            # OAuth 2.0 PKCE, the access_token acts as the bearer token
            return tweepy.Client(bearer_token=self.access_token)

    def publish_post(self, text, image_path=None):
        try:
            client = self._get_v2_client()
            
            media_ids = []
            if image_path:
                if self.api_key and self.api_secret and self.access_token_secret:
                    # v1.1 API is required for media upload with manual keys
                    api_v1 = self._get_v1_api()
                    media = api_v1.media_upload(filename=image_path)
                    media_ids.append(media.media_id)
                    logger.info(f"Successfully uploaded media to Twitter with id {media.media_id}")
                else:
                    # OAuth 2.0 PKCE doesn't fully support v1.1 media upload out of the box without user context
                    logger.warning("Media upload with pure OAuth 2.0 is experimental.")
                    pass
            
            # Post the tweet using v2 client
            is_oauth1 = bool(self.api_key and self.api_secret and self.access_token_secret)
            if media_ids:
                response = client.create_tweet(text=text, media_ids=media_ids, user_auth=is_oauth1)
            else:
                response = client.create_tweet(text=text, user_auth=is_oauth1)
                
            return {
                "success": True,
                "platform_post_id": str(response.data['id']),
            }
        except Exception as e:
            logger.error(f"Error publishing to Twitter: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
