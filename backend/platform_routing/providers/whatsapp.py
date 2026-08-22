import os
import requests
from abc import ABC, abstractmethod
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class WhatsAppProvider(ABC):
    @abstractmethod
    def validate_connection(self) -> bool:
        pass
        
    @abstractmethod
    def send_text(self, target_number: str, content: str) -> dict:
        pass
        
    @abstractmethod
    def send_media(self, target_number: str, content: str, media_url: str) -> dict:
        pass

class MetaWhatsAppProvider(WhatsAppProvider):
    def __init__(self, phone_number_id: str, access_token: str):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.api_version = getattr(settings, 'META_API_VERSION', None)
        if not self.api_version:
            raise ValueError("META_API_VERSION is not configured in settings. Cannot safely communicate with Meta API.")
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"

    def _get_headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

    def _sanitize_error(self, e: requests.RequestException) -> str:
        """Sanitizes exceptions to ensure access tokens are never logged."""
        status_code = getattr(e.response, 'status_code', 'unknown')
        err_msg = f"status={status_code}"
        
        if e.response is not None:
            try:
                # Try to extract safe fields from Meta's JSON error format
                err_json = e.response.json().get('error', {})
                error_type = err_json.get('type', 'UnknownType')
                code = err_json.get('code', 'UnknownCode')
                # Do not log the raw message as it might contain the token
                err_msg += f", error_type={error_type}, code={code}"
            except Exception:
                err_msg += ", body_parsing_failed=true"
        
        return err_msg

    def validate_connection(self) -> bool:
        """
        Validates the connection by fetching the business profile or phone number metadata.
        """
        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}"
        try:
            response = requests.get(url, headers=self._get_headers(), timeout=10)
            if response.status_code == 200:
                return True
            logger.warning(f"Meta API validation failed: {self._sanitize_error(requests.exceptions.HTTPError(response=response))}")
            return False
        except requests.RequestException as e:
            logger.error(f"Meta API connection error: {self._sanitize_error(e)}")
            return False

    def send_text(self, target_number: str, content: str) -> dict:
        payload = {
            "messaging_product": "whatsapp",
            "to": target_number,
            "type": "text",
            "text": {"body": content}
        }
        try:
            response = requests.post(self.base_url, json=payload, headers=self._get_headers(), timeout=20)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except requests.RequestException as e:
            safe_error = self._sanitize_error(e)
            logger.error(f"Meta WhatsApp API request failed: {safe_error}")
            # We can still pass the exception to celery for retry logic, but safe
            return {"success": False, "error": safe_error, "status_code": getattr(e.response, 'status_code', None)}

    def send_media(self, target_number: str, content: str, media_url: str) -> dict:
        payload = {
            "messaging_product": "whatsapp",
            "to": target_number,
            "type": "image",
            "image": {
                "link": media_url,
                "caption": content
            }
        }
        try:
            response = requests.post(self.base_url, json=payload, headers=self._get_headers(), timeout=20)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except requests.RequestException as e:
            safe_error = self._sanitize_error(e)
            logger.error(f"Meta WhatsApp API request failed: {safe_error}")
            return {"success": False, "error": safe_error, "status_code": getattr(e.response, 'status_code', None)}
