from django.test import TestCase
from django.db import IntegrityError
from .models import Plan, PlanEntitlement, SystemSetting

class Phase5APlanTests(TestCase):
    def test_plan_code_uniqueness(self):
        Plan.objects.create(name='Pro', code='PRO', price=10.00, billing_interval='MONTHLY')
        with self.assertRaises(IntegrityError):
            Plan.objects.create(name='Pro 2', code='PRO', price=15.00, billing_interval='YEARLY')

    def test_plan_entitlement_uniqueness(self):
        plan = Plan.objects.create(name='Pro', code='PRO', price=10.00, billing_interval='MONTHLY')
        PlanEntitlement.objects.create(plan=plan, feature_code='FEATURE_A', enabled=True)
        with self.assertRaises(IntegrityError):
            PlanEntitlement.objects.create(plan=plan, feature_code='FEATURE_A', enabled=False)

    def test_entitlement_limit_period_choices(self):
        plan = Plan.objects.create(name='Pro', code='PRO', price=10.00, billing_interval='MONTHLY')
        entitlement = PlanEntitlement.objects.create(
            plan=plan, 
            feature_code='FEATURE_A', 
            enabled=True, 
            limit_value=100, 
            limit_period='MONTHLY'
        )
        self.assertEqual(entitlement.limit_period, 'MONTHLY')
        self.assertEqual(entitlement.limit_value, 100)

    def test_system_setting_uniqueness(self):
        SystemSetting.objects.create(key='DEFAULT_TRIAL_DAYS', value='30')
        with self.assertRaises(IntegrityError):
            SystemSetting.objects.create(key='DEFAULT_TRIAL_DAYS', value='14')

    def test_default_trial_days_setting(self):
        setting = SystemSetting.objects.create(key='DEFAULT_TRIAL_DAYS', value='30', description='Trial period')
        self.assertEqual(setting.value, '30')
