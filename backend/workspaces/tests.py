from django.test import TestCase
from workspaces.models import User, Workspace, WorkspaceMembership
from django.db import IntegrityError

class WorkspaceMembershipTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="password")
        self.workspace = Workspace.objects.create(name="Test Workspace")

    def test_unique_membership(self):
        # Create first membership
        WorkspaceMembership.objects.create(user=self.user, workspace=self.workspace, role='OWNER')
        
        # Creating a second one should raise IntegrityError
        with self.assertRaises(IntegrityError):
            WorkspaceMembership.objects.create(user=self.user, workspace=self.workspace, role='MEMBER')

    def test_auto_clear_current_workspace_on_suspend(self):
        membership = WorkspaceMembership.objects.create(user=self.user, workspace=self.workspace, role='MEMBER')
        self.user.current_workspace = self.workspace
        self.user.save()
        
        self.assertEqual(self.user.current_workspace, self.workspace)
        
        # Suspend membership
        membership.status = 'SUSPENDED'
        membership.save()
        
        # Refresh user
        self.user.refresh_from_db()
        self.assertIsNone(self.user.current_workspace)

    def test_auto_clear_current_workspace_on_remove(self):
        membership = WorkspaceMembership.objects.create(user=self.user, workspace=self.workspace, role='MEMBER')
        self.user.current_workspace = self.workspace
        self.user.save()
        
        # Remove membership
        membership.status = 'REMOVED'
        membership.save()
        
        self.user.refresh_from_db()
        self.assertIsNone(self.user.current_workspace)
