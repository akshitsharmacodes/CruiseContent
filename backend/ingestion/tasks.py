from celery import shared_task
from celery.utils.log import get_task_logger
from .models import GenerationTask
import traceback
import sys
from django.conf import settings

logger = get_task_logger(__name__)

@shared_task
def process_generation(task_id, platforms):
    try:
        logger.info(f"========== STARTING TASK {task_id} ==========")
        task = GenerationTask.objects.get(id=task_id)
        task.status = 'Processing'
        task.save()
        
        logger.info(f"[Step 1] Formulating context for task {task_id}")
        # Simulate processing for now, capturing actual logic later
        # e.g., using OpenAI and BeautifulSoup
        # Formulate Context
        from workspaces.models import User, BusinessProfile
        context = ""
        user = User.objects.first()
        if user:
            try:
                profile = user.business_profile
                context = f"Business Name: {profile.business_name}\nOpening Hours: {profile.opening_hours}\nServices: {profile.services_provided}\nProcedures: {profile.operational_procedures}"
            except BusinessProfile.DoesNotExist:
                pass
        
        # AI Integration via Factory
        from platform_routing.services import AIServiceFactory
        from platform_routing.models import GeneratedImage
        from django.core.files.base import ContentFile
        
        try:
            provider = getattr(settings, 'AI_PROVIDER', 'gemini')
            ai_service = AIServiceFactory.get_service(provider)
        except ValueError as e:
            logger.error(f"[ERROR] Failed to load AI Service: {e}")
            task.status = 'Failed'
            task.error_message = f"Failed to load AI Service: {e}"
            task.save()
            return

        logger.info(f"[Step 3] Generating text for platforms: {', '.join(platforms)}")
        
        # Step 3.1: Pre-process Classification
        classification = {}
        if ai_service:
            try:
                logger.info("  -> [TEST CASE] Running Dynamic Prompt Classification...")
                classification = ai_service.classify_intent(task.input_data, context)
                logger.info(f"  -> [CLASSIFICATION RESULTS] Persona: {classification.get('persona')}, Goal: {classification.get('goal')}, Tone: {classification.get('tone')}, Format: {classification.get('format')}")
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
                break
            platform_instruction = f"Make this post optimized for {platform}. "
            
            if platform.lower() == 'twitter':
                platform_instruction += "Keep it under 280 characters and use 2-3 hashtags."
            elif platform.lower() == 'instagram':
                platform_instruction += "Make it visual-friendly, engaging, and use 5-10 hashtags."
            elif platform.lower() == 'facebook':
                platform_instruction += "Make it conversational and encourage community engagement in the comments."

            system_prompt = (
                f"You are acting as a professional {classification.get('persona', 'Social Media Manager')}. "
                f"Your primary goal is {classification.get('goal', 'Brand Awareness')}. "
                f"Keep the tone {classification.get('tone', 'Engaging')} and use a {classification.get('format', 'Direct')} format. "
                f"You will generate content for a business with the following profile context:\n{context}\n\nCRITICAL INSTRUCTION: Do NOT use any emojis in your response. Emojis are strictly forbidden.\n\n{platform_instruction}"
            )
            user_prompt = f"Analyze the following text content and summarize it into a high-quality social media post:\n\n{task.input_data}"
            
            try:
                generated_text = ai_service.generate_text(system_prompt, user_prompt)
                generated_results[platform] = generated_text
                logger.info(f"  -> Generated content for {platform} successfully.")
            except Exception as e:
                logger.error(f"[ERROR in Text Generation for {platform}]: {str(e)}", exc_info=True)
            
        logger.info("[Step 4] Starting Image Generation phase.")
        image_url = None
        image_error = None
        
        # Ensure we have a valid workspace for the image
        from workspaces.models import Workspace
        target_workspace = (user.workspace if user and hasattr(user, 'workspace') else None) or Workspace.objects.first()

        # Check if the user opted out of image generation
        if not task.generate_image:
            logger.info("  -> Image generation skipped because 'generate_image' toggle is OFF.")
        elif generated_results and target_workspace and ai_service:
            try:
                first_content = list(generated_results.values())[0]
                logger.info("  -> Formulating image prompt based on generated text and user prompt...")
                
                # Pass the custom user_image_prompt if it exists
                image_prompt = ai_service.generate_image_prompt(
                    first_content, 
                    task.user_image_prompt
                )
                logger.info(f"  -> Enhanced Image Prompt: {image_prompt}")
                
                logger.info("  -> Calling AI Service to generate image...")
                image_bytes = ai_service.generate_image(image_prompt)
                
                logger.info("  -> Image downloaded successfully! Saving to database...")
                
                gen_image = GeneratedImage.objects.create(
                    workspace=target_workspace,
                    task=task,
                    prompt_used=image_prompt
                )
                file_name = f"{task.id}_preview.png"
                gen_image.image.save(file_name, ContentFile(image_bytes))
                image_url = gen_image.image.url
                logger.info(f"  -> Image saved successfully at {image_url}")
            except Exception as e:
                logger.error(f"[ERROR in Image Generation]: {str(e)}", exc_info=True)
                image_error = str(e)
        else:
            logger.warning("[Step 4] Skipped image generation (missing api_key or no generated text).")

        if not generated_results:
            logger.error("========== TASK %s FAILED (NO CONTENT GENERATED) ==========", task_id)
            task.status = 'Failed'
            task.error_message = "Failed to generate text content for any platforms. The AI service may be temporarily unavailable."
            task.save()
            return

        logger.info(f"========== TASK {task_id} COMPLETED ==========")
        task.generated_content = {
            "texts": generated_results,
            "image_url": image_url,
            "image_error": image_error
        }
        task.status = 'Completed'
        task.save()
        
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        tb = traceback.extract_tb(exc_traceback)
        # Get the exact line of error
        last_call = tb[-1]
        error_msg = f"Error in {last_call.filename} at line {last_call.lineno}: {str(e)}"
        
        task = GenerationTask.objects.get(id=task_id)
        task.status = 'Failed'
        task.error_message = error_msg
        task.save()
