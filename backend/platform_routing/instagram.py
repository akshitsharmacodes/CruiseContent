import requests
import time

class InstagramAdapter:
    """
    Handles publishing to Instagram Business Accounts via the Meta Graph API.
    """
    GRAPH_API_VERSION = "v20.0"
    GRAPH_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

    def __init__(self, access_token: str, instagram_account_id: str):
        self.access_token = access_token
        self.instagram_account_id = instagram_account_id

    def publish(self, image_url: str, caption: str) -> str:
        """
        Publishes a photo to Instagram.
        Returns the Instagram Post ID if successful.
        Raises an exception if it fails.
        """
        # Step 1: Create a container
        container_id = self._create_container(image_url, caption)
        
        # Step 2: Wait for container to be ready (Graph API is async for images)
        self._wait_for_container(container_id)
        
        # Step 3: Publish the container
        post_id = self._publish_container(container_id)
        return post_id

    def _create_container(self, image_url: str, caption: str) -> str:
        url = f"{self.GRAPH_URL}/{self.instagram_account_id}/media"
        payload = {
            "image_url": image_url,
            "caption": caption,
            "access_token": self.access_token
        }
        response = requests.post(url, data=payload)
        response.raise_for_status()
        return response.json().get("id")

    def _wait_for_container(self, container_id: str, max_retries: int = 5):
        """
        Polls the container status until it is FINISHED.
        """
        url = f"{self.GRAPH_URL}/{container_id}"
        params = {
            "fields": "status_code",
            "access_token": self.access_token
        }
        
        for _ in range(max_retries):
            response = requests.get(url, params=params)
            response.raise_for_status()
            status = response.json().get("status_code")
            if status == "FINISHED":
                return
            elif status == "ERROR":
                raise Exception(f"Container {container_id} failed to process image.")
            
            time.sleep(3)
            
        raise Exception(f"Timeout waiting for container {container_id} to finish processing.")

    def _publish_container(self, container_id: str) -> str:
        url = f"{self.GRAPH_URL}/{self.instagram_account_id}/media_publish"
        payload = {
            "creation_id": container_id,
            "access_token": self.access_token
        }
        response = requests.post(url, data=payload)
        response.raise_for_status()
        return response.json().get("id")
