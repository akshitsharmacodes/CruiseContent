from celery import shared_task, chain
from celery.utils.log import get_task_logger
from celery.exceptions import Retry
from .models import GenerationTask
import traceback
import sys
from django.conf import settings

logger = get_task_logger(__name__)

def update_task_error(task_id, error_msg):
    try:
        task = GenerationTask.objects.get(id=task_id)
        task.status = 'Failed'
        task.error_message = error_msg
        task.save()
    except GenerationTask.DoesNotExist:
        logger.error(f"Task {task_id} not found when trying to update error: {error_msg}")

@shared_task
def start_generation_chain(task_id, platforms):
    """Entry point for the celery chain."""
    logger.info(f"========== STARTING TASK CHAIN {task_id} ==========")
    try:
        task = GenerationTask.objects.get(id=task_id)
        task.status = 'Processing'
        task.save()
    except GenerationTask.DoesNotExist:
        logger.error(f"Task {task_id} not found.")
        return

    # Execute the tasks sequentially
    workflow = chain(
        generate_text_task.s(task_id, platforms),
        generate_image_task.s(),
        finalize_generation_task.s()
    )
    workflow.apply_async()


@shared_task(bind=True, max_retries=3)
def generate_text_task(self, task_id, platforms):
    import asyncio
    logger.info(f"[Step 1] Formulating context and generating text for task {task_id}")
    try:
        try:
            task = GenerationTask.objects.get(id=task_id)
        except GenerationTask.DoesNotExist as e:
            logger.warning(f"Task {task_id} not found in DB yet, retrying...")
            raise self.retry(exc=e, countdown=2 ** self.request.retries)
        
        from workspaces.models import BusinessProfile, Workspace
        context = ""
        workspace = task.workspace or Workspace.objects.first()
        if workspace:
            try:
                profile = workspace.business_profile
                context = f"Business Name: {profile.business_name}\nOpening Hours: {profile.opening_hours}\nServices: {profile.services_provided}\nProcedures: {profile.operational_procedures}"
            except BusinessProfile.DoesNotExist:
                pass
        
        from platform_routing.services import AIServiceFactory
        try:
            provider = getattr(settings, 'AI_PROVIDER', 'nvidia')
            ai_service = AIServiceFactory.get_service(provider)
        except ValueError as e:
            raise Exception(f"Failed to load AI Service: {e}")

        classification = {}
        if ai_service:
            try:
                classification = ai_service.classify_intent(task.input_data, context)
                logger.info(f"Intent classified: {classification}")
            except Exception as e:
                logger.error(f"[ERROR in Classification]: {e}")
                classification = {
                    "persona": "Social Media Manager",
                    "goal": "Brand Awareness",
                    "tone": "Engaging",
                    "format": "Standard Post"
                }

        generated_results = {}
        for platform in platforms:
            if not ai_service:
                continue
            
            logger.info(f"--> Generating content for platform: {platform}")
            platform_instruction = f"Make this post highly optimized and engaging for {platform}."
            if platform.lower() == 'twitter':
                platform_instruction += " Keep it under 280 chars."
            elif platform.lower() == 'instagram':
                platform_instruction += " Include 8 trending hashtags."
            elif platform.lower() == 'linkedin':
                platform_instruction += " Professional tone."
            elif platform.lower() == 'facebook':
                platform_instruction += " Conversational and engaging."

            system_prompt = (
                f"You are a {classification.get('persona', 'Social Media Manager')}. "
                f"Goal: {classification.get('goal', 'Brand Awareness')}. Tone: {classification.get('tone', 'Engaging')}.\n\n"
                f"Business Context: {context}\nTARGET PLATFORM: {platform.upper()}\n"
                f"OUTPUT FORMATTING: strictly the final post text."
            )
            user_prompt = f"--- SOURCE CONTENT ---\n{task.input_data}\n\n--- PLATFORM RULES ---\n{platform_instruction}"
            
            try:
                res = ai_service.generate_text(system_prompt, user_prompt)
                generated_results[platform] = res
                logger.info(f"✓ Generated content for {platform}: {res[:60]}...")
            except Exception as e:
                logger.error(f"[ERROR in Text Generation for {platform}]: {str(e)}")
                
        if not generated_results:
            raise Exception("Failed to generate text content for any platforms.")

        return {
            'task_id': task_id,
            'generated_results': generated_results
        }
    except Retry:
        raise
    except Exception as e:
        update_task_error(task_id, str(e))
        raise self.retry(exc=e, countdown=2 ** self.request.retries)

@shared_task(bind=True, max_retries=3)
def generate_image_task(self, context_data):
    task_id = context_data.get('task_id')
    generated_results = context_data.get('generated_results', {})
    
    logger.info(f"[Step 2] Generating image for task {task_id}")
    try:
        task = GenerationTask.objects.get(id=task_id)
        image_url = None
        image_error = None
        
        from workspaces.models import Workspace
        from platform_routing.services import AIServiceFactory
        from platform_routing.models import GeneratedImage
        from django.core.files.base import ContentFile
        
        target_workspace = task.workspace or Workspace.objects.first()
        
        try:
            provider = getattr(settings, 'AI_PROVIDER', 'nvidia')
            ai_service = AIServiceFactory.get_service(provider)
        except Exception as e:
            ai_service = None

        if not task.generate_image:
            logger.info("  -> Image generation skipped.")
        elif generated_results and target_workspace and ai_service:
            try:
                first_content = list(generated_results.values())[0]
                base_image_context = f"Create a high-quality, visually appealing image for a social media post. Context: {first_content[:200]}..."
                if task.user_image_prompt:
                    base_image_context += f" Specific request: {task.user_image_prompt}"
                
                logger.info(f"Creating image prompt with AI provider: {provider}")
                image_prompt = ai_service.generate_image_prompt(first_content, base_image_context)
                logger.info(f"Image prompt formulated: {image_prompt[:100]}...")
                
                logger.info("Calling image generation service...")
                image_bytes = ai_service.generate_image(image_prompt)
                
                gen_image = GeneratedImage.objects.create(
                    workspace=target_workspace,
                    task=task,
                    prompt_used=image_prompt
                )
                file_name = f"{task.id}_preview.png"
                gen_image.image.save(file_name, ContentFile(image_bytes))
                image_url = gen_image.image.url
                logger.info(f"✓ Image saved successfully: {image_url}")
            except Exception as e:
                image_error = str(e)
                logger.error(f"[ERROR in Image Generation]: {image_error}")

        context_data['image_url'] = image_url
        context_data['image_error'] = image_error
        return context_data
    except Retry:
        raise
    except Exception as e:
        update_task_error(task_id, str(e))
        raise self.retry(exc=e, countdown=5)

@shared_task
def finalize_generation_task(context_data):
    task_id = context_data.get('task_id')
    logger.info(f"========== FINALIZING TASK {task_id} ==========")
    try:
        task = GenerationTask.objects.get(id=task_id)
        task.generated_content = {
            "texts": context_data.get('generated_results', {}),
            "image_url": context_data.get('image_url'),
            "image_error": context_data.get('image_error')
        }
        task.status = 'Completed'
        task.save()
        logger.info(f"========== TASK {task_id} COMPLETED ==========")
    except Exception as e:
        update_task_error(task_id, str(e))
