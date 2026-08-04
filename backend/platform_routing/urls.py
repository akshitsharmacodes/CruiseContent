from django.urls import path
from .views import (
    PublishPostView, PublishPostStatusView, FacebookLoginView, FacebookCallbackView, ConnectManualFacebookView,
    GetConnectedPlatformsView, ConnectManualTwitterView, TwitterLoginView, TwitterCallbackView
)

urlpatterns = [
    path('publish/', PublishPostView.as_view(), name='publish_post'),
    path('publish/status/<uuid:post_id>/', PublishPostStatusView.as_view(), name='publish_post_status'),
    path('connected/', GetConnectedPlatformsView.as_view(), name='connected_platforms'),
    
    path('facebook/login/', FacebookLoginView.as_view(), name='facebook_login'),
    path('facebook/callback/', FacebookCallbackView.as_view(), name='facebook_callback'),
    path('facebook/connect-manual/', ConnectManualFacebookView.as_view(), name='connect_manual_facebook'),
    
    path('twitter/login/', TwitterLoginView.as_view(), name='twitter_login'),
    path('twitter/callback/', TwitterCallbackView.as_view(), name='twitter_callback'),
    path('twitter/connect-manual/', ConnectManualTwitterView.as_view(), name='connect_manual_twitter'),
]
