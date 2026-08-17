import os
import requests
from django.conf import settings
from requests.exceptions import RequestException
import logging

logger = logging.getLogger(__name__)

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "sofric_super_secret_key")

def get_headers():
    return {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }

def create_instance(workspace_id):
    """
    Creates a new Evolution API instance for the given workspace and returns the QR code.
    """
    instance_name = f"workspace_{workspace_id}"
    url = f"{EVOLUTION_API_URL}/instance/create"
    payload = {
        "instanceName": instance_name,
        "qrcode": True,
        "integration": "WHATSAPP-BAILEYS",
        "webhook_wa_business": False
    }
    
    try:
        response = requests.post(url, json=payload, headers=get_headers(), timeout=15)
        
        # Check if already exists (Evolution API returns 403 when name is in use)
        if response.status_code == 403 and "already in use" in response.text:
            logger.info(f"Instance {instance_name} already exists. Fetching connect QR.")
            connect_url = f"{EVOLUTION_API_URL}/instance/connect/{instance_name}"
            conn_resp = requests.get(connect_url, headers=get_headers(), timeout=15)
            conn_resp.raise_for_status()
            qr_code = conn_resp.json().get('base64', '')
            
            # If the qr_code is still empty, the instance is likely stuck in 'open' state but desynced from our DB.
            if not qr_code:
                logger.info(f"Instance {instance_name} is stuck (no QR returned). Deleting and recreating.")
                delete_instance(instance_name)
                # Retry creation once
                return create_instance(workspace_id)
                
            return {
                "success": True,
                "instance_name": instance_name,
                "qr_code": qr_code
            }
            
        response.raise_for_status()
        data = response.json()
        
        # Depending on version, QR might be in response or require a connect call
        qr_code = data.get('qrcode', {}).get('base64', '')
        if not qr_code:
            # Try connecting if not returned initially
            connect_url = f"{EVOLUTION_API_URL}/instance/connect/{instance_name}"
            conn_resp = requests.get(connect_url, headers=get_headers(), timeout=15)
            conn_resp.raise_for_status()
            qr_code = conn_resp.json().get('base64', '')
            
        return {
            "success": True,
            "instance_name": instance_name,
            "qr_code": qr_code
        }
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 403 and "already in use" in e.response.text:
            logger.info(f"Instance {instance_name} already exists (caught HTTPError). Fetching connect QR.")
            try:
                connect_url = f"{EVOLUTION_API_URL}/instance/connect/{instance_name}"
                conn_resp = requests.get(connect_url, headers=get_headers(), timeout=15)
                conn_resp.raise_for_status()
                qr_code = conn_resp.json().get('base64', '')
                
                # If the qr_code is still empty, the instance is likely stuck in 'open' state but desynced from our DB.
                if not qr_code:
                    logger.info(f"Instance {instance_name} is stuck (no QR returned). Deleting and recreating.")
                    delete_instance(instance_name)
                    # Retry creation once
                    return create_instance(workspace_id)
                
                return {
                    "success": True,
                    "instance_name": instance_name,
                    "qr_code": qr_code
                }
            except Exception as conn_e:
                logger.error(f"Failed to fetch connect QR for existing instance: {conn_e}")
                return {"success": False, "error": str(conn_e)}
                
        logger.error(f"HTTPError creating Evolution API instance: {e} - Response: {e.response.text}")
        return {"success": False, "error": str(e)}
    except RequestException as e:
        logger.error(f"Failed to create Evolution API instance: {e}")
        return {"success": False, "error": str(e)}

def publish_to_whatsapp(post_id, instance_name, content, media_url=None, target_number="status@broadcast"):
    """
    Publishes a message or status via Evolution API.
    target_number can be a phone number for DMs, or 'status@broadcast' for status.
    """
    try:
        if media_url:
            # Send media message
            url = f"{EVOLUTION_API_URL}/message/sendMedia/{instance_name}"
            payload = {
                "number": target_number,
                "mediatype": "image",
                "media": media_url,
                "caption": content
            }
        else:
            # Send text message
            url = f"{EVOLUTION_API_URL}/message/sendText/{instance_name}"
            payload = {
                "number": target_number,
                "text": content
            }

        response = requests.post(url, json=payload, headers=get_headers(), timeout=20)
        response.raise_for_status()
        return {"success": True, "data": response.json()}
        
    except RequestException as e:
        logger.error(f"Failed to publish to WhatsApp: {e}")
        return {"success": False, "error": str(e)}

def delete_instance(instance_name):
    """
    Deletes an instance when a workspace disconnects WhatsApp.
    """
    url = f"{EVOLUTION_API_URL}/instance/delete/{instance_name}"
    try:
        response = requests.delete(url, headers=get_headers(), timeout=15)
        response.raise_for_status()
        return {"success": True}
    except RequestException as e:
        logger.error(f"Failed to delete Evolution API instance: {e}")
        return {"success": False, "error": str(e)}
