import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

from celery.schedules import crontab

app = Celery('core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'process-scheduled-posts-every-5-minutes': {
        'task': 'platform_routing.tasks.process_scheduled_posts',
        'schedule': crontab(minute='*/5'),
    },
}
