import requests

class FacebookAdapter:
    """
    Handles publishing to Facebook Pages via the Meta Graph API.
    """
    GRAPH_API_VERSION = "v20.0"
    GRAPH_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

    def __init__(self, access_token: str, page_id: str):
        self.access_token = access_token
        self.page_id = page_id

    def publish(self, image_url: str, caption: str) -> str:
        """
        Publishes a photo with a caption directly to a Facebook Page.
        Returns the Facebook Post ID if successful.
        Raises an exception if it fails.
        """
        if image_url:
            url = f"{self.GRAPH_URL}/{self.page_id}/photos"
            payload = {
                "url": image_url,
                "message": caption,
                "access_token": self.access_token
            }
        else:
            url = f"{self.GRAPH_URL}/{self.page_id}/feed"
            payload = {
                "message": caption,
                "access_token": self.access_token
            }
        
        response = requests.post(url, data=payload)
        response.raise_for_status()
        
        data = response.json()
        return data.get("post_id") or data.get("id")
