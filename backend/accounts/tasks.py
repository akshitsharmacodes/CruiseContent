from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils.html import strip_tags

@shared_task
def send_welcome_email(user_email, user_name):
    """
    Sends a premium welcome email to the newly signed up user.
    Uses Django's console email backend for local development.
    """
    subject = "Welcome to SofricAI - Elevate Your Content"
    
    html_message = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 40px; color: #18181b;">
            <div style="max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 20px;">Welcome to SofricAI, {user_name}! 🚀</h1>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    We are thrilled to have you onboard. SofricAI is designed to be your premium content generation partner, 
                    learning your business profile and automatically drafting high-converting posts for Meta and Twitter.
                </p>
                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 20px;">
                    <p style="margin: 0; font-weight: 500;">Next Step: Complete your Business Profile to unlock personalized AI generation.</p>
                </div>
                <a href="http://localhost:5173/profile" style="display: inline-block; background-color: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Go to Dashboard
                </a>
            </div>
        </body>
    </html>
    """
    
    plain_message = strip_tags(html_message)
    
    # We fallback to DEFAULT_FROM_EMAIL if it's set, else a placeholder
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'hello@sofricai.com')
    
    send_mail(
        subject,
        plain_message,
        from_email,
        [user_email],
        html_message=html_message,
        fail_silently=False,
    )
    
    return f"Sent welcome email to {user_email}"
