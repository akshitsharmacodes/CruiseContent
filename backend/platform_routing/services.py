import os
import requests
from django.conf import settings
from django.core.files.base import ContentFile
import uuid
import base64
from abc import ABC, abstractmethod

class BaseAIService(ABC):
    @abstractmethod
    def generate_text(self, system_prompt: str, user_prompt: str) -> str:
        pass

    @abstractmethod
    def generate_image_prompt(self, post_text: str, user_prompt: str = None) -> str:
        pass

    @abstractmethod
    def generate_image(self, prompt: str) -> bytes:
        pass

    @abstractmethod
    def classify_intent(self, user_input: str, business_context: str) -> dict:
        pass


class GeminiService(BaseAIService):
    def __init__(self):
        self.api_key = getattr(settings, 'GEMINI_API_KEY', None)
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not set in Django settings.")

    def generate_text(self, system_prompt: str, user_prompt: str) -> str:
        import time
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent"
        combined_prompt = f"System Instruction:\n{system_prompt}\n\nUser Request:\n{user_prompt}"

        headers = {
            'Content-Type': 'application/json',
            'X-goog-api-key': self.api_key
        }
        
        payload = {
            "contents": [
                {"parts": [{"text": combined_prompt}]}
            ]
        }
        
        max_retries = 5
        for attempt in range(max_retries):
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            if response.status_code == 429 and attempt < max_retries - 1:
                # Long backoff because Gemini Free Tier resets every minute
                time.sleep(15 * (attempt + 1)) # 15s, 30s, 45s, 60s
                continue
            response.raise_for_status()
            
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    def classify_intent(self, user_input: str, business_context: str) -> dict:
        import json
        system_prompt = (
            "You are a classification engine. You must output STRICTLY valid JSON with no markdown formatting. "
            "Extract the following from the user's input and business context: "
            "'persona' (e.g. Dentist, Advocate, Tech Expert), "
            "'goal' (e.g. Engagement, Conversion, Education), "
            "'tone' (e.g. Professional, Casual, Urgent), "
            "'format' (e.g. Storytelling, Q&A, Direct Pitch)."
        )
        user_prompt = f"Business Context: {business_context}\n\nUser Input: {user_input}"
        
        result_text = self.generate_text(system_prompt, user_prompt)
        
        try:
            clean_text = result_text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except json.JSONDecodeError:
            return {
                "persona": "Social Media Manager",
                "goal": "Brand Awareness",
                "tone": "Engaging",
                "format": "Standard Post"
            }

    def generate_image_prompt(self, post_text: str, user_prompt: str = None) -> str:
        system_prompt = (
            "You are an expert image prompt generator. Your task is to read a social media post "
            "and an optional base image prompt from the user. You must create a single, highly detailed, "
            "optimized prompt for an AI image generator (like Stable Diffusion) that captures the essence of the post "
            "while strictly following the user's base prompt. Do not include conversational text, just the prompt."
        )

        user_content = f"Post: {post_text}"
        if user_prompt:
            user_content += f"\nUser's Base Prompt: {user_prompt}"
            
        return self.generate_text(system_prompt, user_content)

    def generate_image(self, prompt: str) -> bytes:
        import urllib.parse
        
        # We are falling back to Pollinations.ai for image generation because the Google AI Studio 
        # API key encountered a 429 Quota Exceeded error for the gemini-3.1-flash-lite-image model.
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
        
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        return response.content


class OpenRouterService(BaseAIService):
    def __init__(self):
        self.api_key = getattr(settings, 'OPENROUTER_API_KEY', None)
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not set in Django settings.")
            
    def generate_text(self, system_prompt: str, user_prompt: str) -> str:
        import time
        import json
        url = "https://openrouter.ai/api/v1/chat/completions"
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_key}',
            'HTTP-Referer': getattr(settings, 'SITE_URL', 'http://localhost:8000'),
            'X-Title': 'SofricAI'
        }
        
        payload = {
            "model": "google/gemma-4-31b-it:free",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        
        max_retries = 8
        for attempt in range(max_retries):
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            if response.status_code == 429 and attempt < max_retries - 1:
                time.sleep(20 * (attempt + 1))
                continue
            response.raise_for_status()
            
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

    def classify_intent(self, user_input: str, business_context: str) -> dict:
        import json
        system_prompt = (
            "You are a classification engine. You must output STRICTLY valid JSON with no markdown formatting. "
            "Extract the following from the user's input and business context: "
            "'persona' (e.g. Dentist, Advocate, Tech Expert), "
            "'goal' (e.g. Engagement, Conversion, Education), "
            "'tone' (e.g. Professional, Casual, Urgent), "
            "'format' (e.g. Storytelling, Q&A, Direct Pitch)."
        )
        user_prompt = f"Business Context: {business_context}\n\nUser Input: {user_input}"
        
        result_text = self.generate_text(system_prompt, user_prompt)
        
        try:
            clean_text = result_text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except json.JSONDecodeError:
            return {
                "persona": "Social Media Manager",
                "goal": "Brand Awareness",
                "tone": "Engaging",
                "format": "Standard Post"
            }

    def generate_image_prompt(self, post_text: str, user_prompt: str = None) -> str:
        system_prompt = (
            "You are an expert image prompt generator. Your task is to read a social media post "
            "and an optional base image prompt from the user. You must create a single, highly detailed, "
            "optimized prompt for an AI image generator (like Stable Diffusion) that captures the essence of the post "
            "while strictly following the user's base prompt. Do not include conversational text, just the prompt."
        )

        user_content = f"Post: {post_text}"
        if user_prompt:
            user_content += f"\nUser's Base Prompt: {user_prompt}"
            
        return self.generate_text(system_prompt, user_content)

    def generate_image(self, prompt: str) -> bytes:
        import urllib.parse
        encoded_prompt = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        return response.content


class AIServiceFactory:
    @staticmethod
    def get_service(provider: str = "gemini") -> BaseAIService:
        if provider.lower() == "gemini":
            return GeminiService()
        elif provider.lower() == "openrouter":
            return OpenRouterService()
        raise ValueError(f"Unknown AI provider: {provider}")
