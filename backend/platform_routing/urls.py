from django.urls import path
from .views import (
    PublishPostView, PublishPostStatusView, FacebookLoginView, FacebookCallbackView, ConnectManualFacebookView,
    GetConnectedPlatformsView, ConnectManualTwitterView, TwitterLoginView, TwitterCallbackView, DisconnectPlatformView,
    ScheduledPostsView, ScheduledPostDetailView, WhatsAppGetQRView, WhatsAppWebhookView
)

urlpatterns = [
    path('publish/', PublishPostView.as_view(), name='publish_post'),
    path('publish/status/<uuid:post_id>/', PublishPostStatusView.as_view(), name='publish_post_status'),
    path('scheduled/', ScheduledPostsView.as_view(), name='scheduled_posts'),
    path('scheduled/<uuid:post_id>/', ScheduledPostDetailView.as_view(), name='scheduled_post_detail'),
    path('connected/', GetConnectedPlatformsView.as_view(), name='connected_platforms'),
    path('disconnect/<str:platform_name>/', DisconnectPlatformView.as_view(), name='disconnect_platform'),
    
    path('facebook/login/', FacebookLoginView.as_view(), name='facebook_login'),
    path('facebook/callback/', FacebookCallbackView.as_view(), name='facebook_callback'),
    path('facebook/connect-manual/', ConnectManualFacebookView.as_view(), name='connect_manual_facebook'),
    
    path('twitter/login/', TwitterLoginView.as_view(), name='twitter_login'),
    path('twitter/callback/', TwitterCallbackView.as_view(), name='twitter_callback'),
    path('twitter/connect-manual/', ConnectManualTwitterView.as_view(), name='connect_manual_twitter'),
    
    path('whatsapp/qr/', WhatsAppGetQRView.as_view(), name='whatsapp_qr'),
    path('whatsapp/webhook/', WhatsAppWebhookView.as_view(), name='whatsapp_webhook'),
]
