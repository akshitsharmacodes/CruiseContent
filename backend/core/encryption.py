import os
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def get_cipher():
    key = getattr(settings, 'WHATSAPP_ENCRYPTION_KEY', None)
    if not key:
        logger.error("WHATSAPP_ENCRYPTION_KEY is not set in Django settings.")
        raise ValueError("Encryption key is missing. WhatsApp integrations cannot function safely.")
    
    # Fernet keys must be 32 URL-safe base64-encoded bytes.
    try:
        return Fernet(key.encode('utf-8'))
    except Exception as e:
        logger.error(f"Invalid WHATSAPP_ENCRYPTION_KEY provided: {str(e)}")
        raise ValueError("Invalid WHATSAPP_ENCRYPTION_KEY. Must be a URL-safe base64-encoded 32-byte key.")

def encrypt_token(token: str) -> bytes:
    """Encrypts a plaintext string token and returns bytes."""
    if not token:
        return b""
    cipher = get_cipher()
    return cipher.encrypt(token.encode('utf-8'))

def decrypt_token(encrypted_token: bytes) -> str:
    """Decrypts a bytes token and returns the plaintext string."""
    if not encrypted_token:
        return ""
    cipher = get_cipher()
    try:
        decrypted = cipher.decrypt(encrypted_token)
        return decrypted.decode('utf-8')
    except InvalidToken:
        logger.error("Failed to decrypt WhatsApp token. The key may have changed or data is corrupted.")
        raise ValueError("Failed to decrypt token. Invalid token or key.")
