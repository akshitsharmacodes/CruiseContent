import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ---------------------------------------------------------------------------
# Beat schedule — stored in the database via django-celery-beat.
# This ensures the beat state survives Render deploys and prevents duplicate
# beats if multiple processes race to acquire the schedule lock.
#
# The schedule below is loaded into the database on first run via:
#   python manage.py migrate
#   python manage.py setup_periodic_tasks  (if you add a management command)
#
# Or simply let Celery Beat register these entries automatically on startup.
# ---------------------------------------------------------------------------

from celery.schedules import crontab  # noqa: E402

app.conf.beat_schedule = {
    'process-scheduled-posts-every-5-minutes': {
        'task': 'platform_routing.tasks.process_scheduled_posts',
        'schedule': crontab(minute='*/5'),
    },
}
