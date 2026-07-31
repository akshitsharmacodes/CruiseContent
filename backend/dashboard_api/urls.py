from django.urls import path
from .views import DashboardStatusView

urlpatterns = [
    path('status/', DashboardStatusView.as_view(), name='dashboard-status'),
]
