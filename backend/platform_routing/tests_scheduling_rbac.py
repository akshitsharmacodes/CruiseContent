from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from workspaces.models import Workspace, WorkspaceMembership, WorkspaceRole, PlatformAccount
from platform_routing.models import SocialPost
from payments.models import Plan, Subscription, PlanEntitlement

User = get_user_model()

class SchedulingRBACTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Enterprise Plan with full entitlements
        self.plan = Plan.objects.create(
            name="Enterprise Test Plan",
            code="ENT_TEST",
            billing_interval="MONTHLY",
            price=100
        )
        for code in ['SOCIAL_MEDIA_MANAGER', 'POSTS', 'SCHEDULING', 'ANALYTICS']:
            PlanEntitlement.objects.create(plan=self.plan, feature_code=code)

        # Workspaces
        self.workspace_a = Workspace.objects.create(name="Workspace A", status="ACTIVE")
        self.workspace_b = Workspace.objects.create(name="Workspace B", status="ACTIVE")

        Subscription.objects.create(workspace=self.workspace_a, plan=self.plan, status="ACTIVE")
        Subscription.objects.create(workspace=self.workspace_b, plan=self.plan, status="ACTIVE")

        # Platform accounts
        self.platform_acc_a = PlatformAccount.objects.create(
            workspace=self.workspace_a,
            platform="TWITTER",
            name="Twitter Acc A",
            account_id="tw_a",
            access_token="tok",
            is_active=True
        )
        self.platform_acc_b = PlatformAccount.objects.create(
            workspace=self.workspace_b,
            platform="TWITTER",
            name="Twitter Acc B",
            account_id="tw_b",
            access_token="tok",
            is_active=True
        )

        # Users
        self.owner_user = User.objects.create_user(username="owner", email="owner@test.com", password="password123", current_workspace=self.workspace_a)
        WorkspaceMembership.objects.create(user=self.owner_user, workspace=self.workspace_a, role="OWNER", status="ACTIVE")

        self.restricted_user = User.objects.create_user(username="restricted", email="restricted@test.com", password="password123", current_workspace=self.workspace_a)
        # Custom role with only POSTS:VIEW and POSTS:CREATE (no SCHEDULING permissions)
        self.no_schedule_role = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name="No Schedule Role",
            permissions=[
                {"software": "SOCIAL_MEDIA_MANAGER", "feature": "POSTS", "actions": ["VIEW", "CREATE"]}
            ]
        )
        WorkspaceMembership.objects.create(
            user=self.restricted_user,
            workspace=self.workspace_a,
            role="MEMBER",
            custom_role=self.no_schedule_role,
            status="ACTIVE"
        )

        # Custom role with SCHEDULING permissions
        self.scheduler_user = User.objects.create_user(username="scheduler", email="scheduler@test.com", password="password123", current_workspace=self.workspace_a)
        self.schedule_role = WorkspaceRole.objects.create(
            workspace=self.workspace_a,
            name="Scheduler Role",
            permissions=[
                {"software": "SOCIAL_MEDIA_MANAGER", "feature": "POSTS", "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"]},
                {"software": "SOCIAL_MEDIA_MANAGER", "feature": "SCHEDULING", "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"]}
            ]
        )
        WorkspaceMembership.objects.create(
            user=self.scheduler_user,
            workspace=self.workspace_a,
            role="MEMBER",
            custom_role=self.schedule_role,
            status="ACTIVE"
        )

    def test_scheduled_posts_workspace_isolation(self):
        """Posts from workspace B must never appear when querying workspace A."""
        future_time = timezone.now() + timedelta(days=2)
        post_a = SocialPost.objects.create(
            platform_account=self.platform_acc_a,
            content="Post for Workspace A",
            status="SCHEDULED",
            scheduled_for=future_time
        )
        post_b = SocialPost.objects.create(
            platform_account=self.platform_acc_b,
            content="Post for Workspace B",
            status="SCHEDULED",
            scheduled_for=future_time
        )

        self.client.force_authenticate(user=self.owner_user)
        res = self.client.get('/api/platform/scheduled/')
        self.assertEqual(res.status_code, 200)
        returned_ids = [p['id'] for p in res.data]
        self.assertIn(str(post_a.id), returned_ids)
        self.assertNotIn(str(post_b.id), returned_ids)

    def test_scheduling_view_permission_enforcement(self):
        """User lacking SOCIAL_MEDIA_MANAGER.SCHEDULING.VIEW gets 403."""
        self.client.force_authenticate(user=self.restricted_user)
        res = self.client.get('/api/platform/scheduled/')
        self.assertEqual(res.status_code, 403)

        self.client.force_authenticate(user=self.scheduler_user)
        res = self.client.get('/api/platform/scheduled/')
        self.assertEqual(res.status_code, 200)

    def test_scheduling_create_permission_enforcement(self):
        """User lacking SCHEDULING.CREATE gets 403 when providing scheduled_for."""
        future_iso = (timezone.now() + timedelta(days=1)).isoformat()

        # Restricted user can create regular post
        self.client.force_authenticate(user=self.restricted_user)
        res_post = self.client.post('/api/platform/posts/', {
            'content': 'Immediate draft post',
            'platform': 'TWITTER'
        })
        self.assertEqual(res_post.status_code, 201)

        # Restricted user cannot schedule post
        res_sched = self.client.post('/api/platform/posts/', {
            'content': 'Scheduled broadcast attempt',
            'platform': 'TWITTER',
            'scheduled_for': future_iso
        })
        self.assertEqual(res_sched.status_code, 403)

        # Scheduler user can schedule post
        self.client.force_authenticate(user=self.scheduler_user)
        res_sched_ok = self.client.post('/api/platform/posts/', {
            'content': 'Valid scheduled broadcast',
            'platform': 'TWITTER',
            'scheduled_for': future_iso
        })
        self.assertEqual(res_sched_ok.status_code, 201)
        self.assertEqual(res_sched_ok.data['status'], 'SCHEDULED')

    def test_reschedule_update_permission_enforcement(self):
        """Rescheduling requires SCHEDULING.UPDATE."""
        future_time = timezone.now() + timedelta(days=2)
        post = SocialPost.objects.create(
            platform_account=self.platform_acc_a,
            content="Original post",
            status="SCHEDULED",
            scheduled_for=future_time
        )

        new_future_iso = (timezone.now() + timedelta(days=4)).isoformat()

        # Restricted user gets 403
        self.client.force_authenticate(user=self.restricted_user)
        res = self.client.put(f'/api/platform/scheduled/{post.id}/', {
            'content': 'Updated content',
            'scheduled_for': new_future_iso
        })
        self.assertEqual(res.status_code, 403)

        # Scheduler user succeeds
        self.client.force_authenticate(user=self.scheduler_user)
        res_ok = self.client.put(f'/api/platform/scheduled/{post.id}/', {
            'content': 'Updated content',
            'scheduled_for': new_future_iso
        })
        self.assertEqual(res_ok.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.content, 'Updated content')

    def test_cancel_delete_permission_enforcement(self):
        """Deleting/canceling a scheduled post requires SCHEDULING.DELETE or POSTS.DELETE."""
        future_time = timezone.now() + timedelta(days=2)
        post = SocialPost.objects.create(
            platform_account=self.platform_acc_a,
            content="Post to cancel",
            status="SCHEDULED",
            scheduled_for=future_time
        )

        # Restricted user gets 403
        self.client.force_authenticate(user=self.restricted_user)
        res = self.client.delete(f'/api/platform/scheduled/{post.id}/')
        self.assertEqual(res.status_code, 403)

        # Scheduler user succeeds
        self.client.force_authenticate(user=self.scheduler_user)
        res_ok = self.client.delete(f'/api/platform/scheduled/{post.id}/')
        self.assertEqual(res_ok.status_code, 200)
        self.assertFalse(SocialPost.objects.filter(id=post.id).exists())

    def test_timezone_aware_storage_no_day_drift(self):
        """Naive timestamp string is made aware according to configured timezone without drifting across days."""
        self.client.force_authenticate(user=self.owner_user)
        res = self.client.post('/api/platform/posts/', {
            'content': 'Timezone test post',
            'platform': 'TWITTER',
            'scheduled_for': '2026-10-15T15:00:00' # Naive string
        })
        self.assertEqual(res.status_code, 201)
        post = SocialPost.objects.get(id=res.data['id'])
        self.assertTrue(timezone.is_aware(post.scheduled_for))
        self.assertEqual(post.scheduled_for.year, 2026)
        self.assertEqual(post.scheduled_for.month, 10)
        self.assertEqual(post.scheduled_for.day, 15)

    def test_date_range_filtering(self):
        """ScheduledPostsView correctly filters by start_date and end_date."""
        now = timezone.now()
        p1 = SocialPost.objects.create(
            platform_account=self.platform_acc_a,
            content="Day 1",
            status="SCHEDULED",
            scheduled_for=now + timedelta(days=1)
        )
        p2 = SocialPost.objects.create(
            platform_account=self.platform_acc_a,
            content="Day 5",
            status="SCHEDULED",
            scheduled_for=now + timedelta(days=5)
        )
        p3 = SocialPost.objects.create(
            platform_account=self.platform_acc_a,
            content="Day 10",
            status="SCHEDULED",
            scheduled_for=now + timedelta(days=10)
        )

        self.client.force_authenticate(user=self.owner_user)
        start_filter = (now + timedelta(days=3)).isoformat()
        end_filter = (now + timedelta(days=7)).isoformat()

        res = self.client.get(f'/api/platform/scheduled/?start_date={start_filter}&end_date={end_filter}')
        self.assertEqual(res.status_code, 200)
        ids = [p['id'] for p in res.data]
        self.assertNotIn(str(p1.id), ids)
        self.assertIn(str(p2.id), ids)
        self.assertNotIn(str(p3.id), ids)
