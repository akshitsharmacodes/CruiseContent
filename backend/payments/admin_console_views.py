from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from accounts.permissions import HasAdminPermission
from accounts.models import AdminAuditLog
from .models import Plan, PlanEntitlement

class AdminPlanManagementView(APIView):
    """
    Phase 8.4 Admin Console Plan management endpoint.
    GET: Requires MASTER or PLANS/VIEW permission.
    POST: Requires MASTER or PLANS/CREATE permission.
    PATCH: Requires MASTER or PLANS/UPDATE permission.
    DELETE: Requires MASTER or PLANS/DELETE permission.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [HasAdminPermission(required_module="PLANS", required_action="CREATE")()]
        elif self.request.method in ['PATCH', 'PUT']:
            return [HasAdminPermission(required_module="PLANS", required_action="UPDATE")()]
        elif self.request.method == 'DELETE':
            return [HasAdminPermission(required_module="PLANS", required_action="DELETE")()]
        return [HasAdminPermission(required_module="PLANS", required_action="VIEW")()]
    
    def get(self, request, plan_id=None):
        if plan_id:
            try:
                plan = Plan.objects.get(id=plan_id)
                data = {
                    'id': plan.id,
                    'name': plan.name,
                    'code': plan.code,
                    'description': plan.description,
                    'price': plan.price,
                    'currency': plan.currency,
                    'billing_interval': plan.billing_interval,
                    'is_active': plan.is_active
                }
                return Response(data)
            except Plan.DoesNotExist:
                return Response(status=status.HTTP_404_NOT_FOUND)
                
        plans = Plan.objects.all().values(
            'id', 'name', 'code', 'price', 'currency', 'billing_interval', 'is_active', 'description'
        )
        return Response({'plans': list(plans)})
        
    def post(self, request):
        name = request.data.get('name')
        code = request.data.get('code')
        price = request.data.get('price')
        billing_interval = request.data.get('billing_interval')
        
        if not all([name, code, price, billing_interval]):
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
            
        if Plan.objects.filter(code=code).exists():
            return Response({'error': 'Plan code already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
        plan = Plan.objects.create(
            name=name,
            code=code,
            description=request.data.get('description', ''),
            price=price,
            currency=request.data.get('currency', 'INR'),
            billing_interval=billing_interval,
            is_active=request.data.get('is_active', True)
        )

        AdminAuditLog.objects.create(
            actor=request.user,
            action='CREATE_PLAN',
            target_admin=None,
            details={
                'plan_id': str(plan.id),
                'plan_code': plan.code,
                'plan_name': plan.name,
                'price': str(plan.price),
                'currency': plan.currency,
                'billing_interval': plan.billing_interval
            }
        )

        return Response({'id': plan.id, 'code': plan.code}, status=status.HTTP_201_CREATED)
        
    def patch(self, request, plan_id):
        try:
            plan = Plan.objects.get(id=plan_id)
        except Plan.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        update_fields = []
        changes = {}
        if 'name' in request.data:
            changes['name'] = {'old': plan.name, 'new': request.data['name']}
            plan.name = request.data['name']
            update_fields.append('name')
        if 'description' in request.data:
            changes['description'] = {'old': plan.description, 'new': request.data['description']}
            plan.description = request.data['description']
            update_fields.append('description')
        if 'is_active' in request.data:
            changes['is_active'] = {'old': plan.is_active, 'new': request.data['is_active']}
            plan.is_active = request.data['is_active']
            update_fields.append('is_active')
        if 'price' in request.data:
            changes['price'] = {'old': str(plan.price), 'new': str(request.data['price'])}
            plan.price = request.data['price']
            update_fields.append('price')
            
        if update_fields:
            plan.save(update_fields=update_fields)
            AdminAuditLog.objects.create(
                actor=request.user,
                action='UPDATE_PLAN',
                target_admin=None,
                details={
                    'plan_id': str(plan.id),
                    'plan_code': plan.code,
                    'changes': changes
                }
            )
            
        return Response({'status': 'updated'})

    def delete(self, request, plan_id):
        try:
            plan = Plan.objects.get(id=plan_id)
        except Plan.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Protect plans tied to subscriptions
        if plan.subscriptions.exists():
            return Response(
                {'error': 'Cannot delete plan because active or past subscriptions reference it. Deactivate the plan instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        plan_code = plan.code
        plan_name = plan.name
        plan.delete()

        AdminAuditLog.objects.create(
            actor=request.user,
            action='DELETE_PLAN',
            target_admin=None,
            details={
                'deleted_plan_id': str(plan_id),
                'deleted_plan_code': plan_code,
                'deleted_plan_name': plan_name
            }
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminPlanEntitlementManagementView(APIView):
    """
    Phase 8.4 Admin Console Plan entitlement endpoint.
    GET: Requires MASTER or PLANS/VIEW permission.
    POST: Requires MASTER or PLANS/UPDATE permission (or CREATE/MANAGE).
    PATCH: Requires MASTER or PLANS/UPDATE permission.
    DELETE: Requires MASTER or PLANS/UPDATE permission (or DELETE).
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [HasAdminPermission(required_module="PLANS", required_action="UPDATE")()]
        elif self.request.method in ['PATCH', 'PUT']:
            return [HasAdminPermission(required_module="PLANS", required_action="UPDATE")()]
        elif self.request.method == 'DELETE':
            return [HasAdminPermission(required_module="PLANS", required_action="UPDATE")()]
        return [HasAdminPermission(required_module="PLANS", required_action="VIEW")()]
    
    def get(self, request, plan_id):
        try:
            plan = Plan.objects.get(id=plan_id)
        except Plan.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        entitlements = PlanEntitlement.objects.filter(plan=plan).values(
            'id', 'feature_code', 'enabled', 'limit_value', 'limit_period'
        )
        return Response({'entitlements': list(entitlements)})
        
    def post(self, request, plan_id):
        try:
            plan = Plan.objects.get(id=plan_id)
        except Plan.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        feature_code = request.data.get('feature_code')
        if not feature_code:
            return Response({'error': 'feature_code is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        if PlanEntitlement.objects.filter(plan=plan, feature_code=feature_code).exists():
            return Response({'error': 'Entitlement already exists for this plan'}, status=status.HTTP_400_BAD_REQUEST)
            
        ent = PlanEntitlement.objects.create(
            plan=plan,
            feature_code=feature_code,
            enabled=request.data.get('enabled', True),
            limit_value=request.data.get('limit_value'),
            limit_period=request.data.get('limit_period', 'NONE')
        )

        AdminAuditLog.objects.create(
            actor=request.user,
            action='UPDATE_PLAN',
            target_admin=None,
            details={
                'plan_id': str(plan.id),
                'plan_code': plan.code,
                'action_subtype': 'CREATE_ENTITLEMENT',
                'feature_code': feature_code
            }
        )

        return Response({'id': ent.id}, status=status.HTTP_201_CREATED)
        
    def patch(self, request, entitlement_id):
        try:
            ent = PlanEntitlement.objects.get(id=entitlement_id)
        except PlanEntitlement.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        update_fields = []
        if 'enabled' in request.data:
            ent.enabled = request.data['enabled']
            update_fields.append('enabled')
        if 'limit_value' in request.data:
            ent.limit_value = request.data['limit_value']
            update_fields.append('limit_value')
        if 'limit_period' in request.data:
            ent.limit_period = request.data['limit_period']
            update_fields.append('limit_period')
            
        if update_fields:
            ent.save(update_fields=update_fields)
            AdminAuditLog.objects.create(
                actor=request.user,
                action='UPDATE_PLAN',
                target_admin=None,
                details={
                    'plan_id': str(ent.plan_id),
                    'entitlement_id': str(ent.id),
                    'feature_code': ent.feature_code,
                    'action_subtype': 'UPDATE_ENTITLEMENT'
                }
            )
            
        return Response({'status': 'updated'})

    def delete(self, request, entitlement_id):
        try:
            ent = PlanEntitlement.objects.get(id=entitlement_id)
        except PlanEntitlement.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        plan_id = ent.plan_id
        feature_code = ent.feature_code
        ent.delete()

        AdminAuditLog.objects.create(
            actor=request.user,
            action='UPDATE_PLAN',
            target_admin=None,
            details={
                'plan_id': str(plan_id),
                'deleted_entitlement_id': str(entitlement_id),
                'feature_code': feature_code,
                'action_subtype': 'DELETE_ENTITLEMENT'
            }
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminSubscriptionManagementView(APIView):
    """
    Stage 9.2 Admin Console Subscription management endpoint.
    GET: Requires MASTER or SUBSCRIPTIONS/VIEW permission.
    PATCH: Requires MASTER or SUBSCRIPTIONS/UPDATE permission.
    """
    def get_permissions(self):
        if self.request.method in ['PATCH', 'PUT']:
            return [HasAdminPermission(required_module="SUBSCRIPTIONS", required_action="UPDATE")()]
        return [HasAdminPermission(required_module="SUBSCRIPTIONS", required_action="VIEW")()]

    def get(self, request, subscription_id=None):
        from .models import Subscription, UsageRecord

        if subscription_id:
            try:
                sub = Subscription.objects.select_related('workspace', 'plan').get(id=subscription_id)
            except Subscription.DoesNotExist:
                return Response({'error': 'Subscription not found'}, status=status.HTTP_404_NOT_FOUND)

            # Scoped Usage Records for this workspace
            usage_records = UsageRecord.objects.filter(workspace=sub.workspace).values(
                'id', 'feature_code', 'period_start', 'period_end', 'usage_count'
            )

            data = {
                'id': str(sub.id),
                'status': sub.status,
                'cancel_at_period_end': sub.cancel_at_period_end,
                'canceled_at': sub.canceled_at.isoformat() if sub.canceled_at else None,
                'trial_start': sub.trial_start.isoformat() if sub.trial_start else None,
                'trial_end': sub.trial_end.isoformat() if sub.trial_end else None,
                'current_period_start': sub.current_period_start.isoformat() if sub.current_period_start else None,
                'current_period_end': sub.current_period_end.isoformat() if sub.current_period_end else None,
                'created_at': sub.created_at.isoformat() if sub.created_at else None,
                'updated_at': sub.updated_at.isoformat() if sub.updated_at else None,
                'workspace': {
                    'id': str(sub.workspace.id),
                    'name': sub.workspace.name,
                    'status': getattr(sub.workspace, 'status', 'ACTIVE')
                },
                'plan': {
                    'id': str(sub.plan.id),
                    'name': sub.plan.name,
                    'code': sub.plan.code,
                    'price': str(sub.plan.price),
                    'currency': sub.plan.currency,
                    'billing_interval': sub.plan.billing_interval,
                    'is_active': sub.plan.is_active
                },
                'usage_records': list(usage_records)
            }
            return Response(data)

        # List with optional query param filtering
        qs = Subscription.objects.select_related('workspace', 'plan').all().order_by('-created_at')

        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

        plan_param = request.query_params.get('plan')
        if plan_param:
            qs = qs.filter(plan_id=plan_param)

        workspace_param = request.query_params.get('workspace')
        if workspace_param:
            qs = qs.filter(workspace_id=workspace_param)

        start_date = request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)

        end_date = request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        subscriptions = []
        for sub in qs:
            subscriptions.append({
                'id': str(sub.id),
                'status': sub.status,
                'cancel_at_period_end': sub.cancel_at_period_end,
                'canceled_at': sub.canceled_at.isoformat() if sub.canceled_at else None,
                'trial_start': sub.trial_start.isoformat() if sub.trial_start else None,
                'trial_end': sub.trial_end.isoformat() if sub.trial_end else None,
                'current_period_start': sub.current_period_start.isoformat() if sub.current_period_start else None,
                'current_period_end': sub.current_period_end.isoformat() if sub.current_period_end else None,
                'created_at': sub.created_at.isoformat() if sub.created_at else None,
                'updated_at': sub.updated_at.isoformat() if sub.updated_at else None,
                'workspace': {
                    'id': str(sub.workspace.id),
                    'name': sub.workspace.name,
                    'status': getattr(sub.workspace, 'status', 'ACTIVE')
                },
                'plan': {
                    'id': str(sub.plan.id),
                    'name': sub.plan.name,
                    'code': sub.plan.code,
                    'price': str(sub.plan.price),
                    'currency': sub.plan.currency,
                    'billing_interval': sub.plan.billing_interval,
                    'is_active': sub.plan.is_active
                }
            })

        return Response({'subscriptions': subscriptions})

    def patch(self, request, subscription_id):
        from .models import Subscription, Plan
        from django.utils import dateparse

        # Reject any attempt to modify immutable / forbidden fields
        forbidden_fields = ['id', 'workspace', 'workspace_id', 'created_at', 'updated_at']
        for f in forbidden_fields:
            if f in request.data:
                return Response({'error': f"Field '{f}' cannot be modified."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sub = Subscription.objects.select_related('workspace', 'plan').get(id=subscription_id)
        except Subscription.DoesNotExist:
            return Response({'error': 'Subscription not found'}, status=status.HTTP_404_NOT_FOUND)

        allowed_fields = ['plan_id', 'plan_code', 'status', 'trial_end', 'current_period_start', 'current_period_end', 'cancel_at_period_end']
        update_fields = []
        changes = {}
        is_plan_change = False
        old_plan_code = sub.plan.code
        old_plan_id = str(sub.plan.id)
        new_plan_obj = None

        # 1. Handle Plan Change
        if 'plan_id' in request.data or 'plan_code' in request.data:
            target_plan_id = request.data.get('plan_id')
            target_plan_code = request.data.get('plan_code')

            if target_plan_id:
                try:
                    new_plan_obj = Plan.objects.get(id=target_plan_id)
                except Plan.DoesNotExist:
                    return Response({'error': 'Target plan does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
            elif target_plan_code:
                new_plan_obj = Plan.objects.filter(code=target_plan_code).first()
                if not new_plan_obj:
                    return Response({'error': f"Plan with code '{target_plan_code}' does not exist."}, status=status.HTTP_400_BAD_REQUEST)

            if new_plan_obj and new_plan_obj.id != sub.plan_id:
                is_plan_change = True
                changes['plan'] = {'old': old_plan_code, 'new': new_plan_obj.code}
                sub.plan = new_plan_obj
                update_fields.append('plan')

        # 2. Handle Status Change
        if 'status' in request.data:
            new_status = request.data['status']
            valid_statuses = [choice[0] for choice in Subscription.STATUS_CHOICES]
            if new_status not in valid_statuses:
                return Response({'error': f"Invalid status. Must be one of {valid_statuses}"}, status=status.HTTP_400_BAD_REQUEST)

            if new_status != sub.status:
                changes['status'] = {'old': sub.status, 'new': new_status}
                sub.status = new_status
                update_fields.append('status')

        # 3. Handle cancel_at_period_end
        if 'cancel_at_period_end' in request.data:
            val = bool(request.data['cancel_at_period_end'])
            if val != sub.cancel_at_period_end:
                changes['cancel_at_period_end'] = {'old': sub.cancel_at_period_end, 'new': val}
                sub.cancel_at_period_end = val
                update_fields.append('cancel_at_period_end')

        # 4. Handle Date Adjustments
        for date_field in ['trial_end', 'current_period_start', 'current_period_end']:
            if date_field in request.data:
                raw_val = request.data[date_field]
                if raw_val is None:
                    parsed_val = None
                else:
                    parsed_val = dateparse.parse_datetime(raw_val) if isinstance(raw_val, str) else raw_val
                    if parsed_val is None and raw_val:
                        return Response({'error': f"Invalid datetime format for {date_field}."}, status=status.HTTP_400_BAD_REQUEST)

                old_val = getattr(sub, date_field)
                if old_val != parsed_val:
                    changes[date_field] = {
                        'old': old_val.isoformat() if old_val else None,
                        'new': parsed_val.isoformat() if parsed_val else None
                    }
                    setattr(sub, date_field, parsed_val)
                    update_fields.append(date_field)

        if not update_fields:
            return Response({'message': 'No changes applied', 'subscription_id': str(sub.id)})

        with transaction.atomic():
            sub.save(update_fields=update_fields)

            action_type = 'ADMIN_CHANGE_SUBSCRIPTION_PLAN' if is_plan_change else 'ADMIN_UPDATE_SUBSCRIPTION'
            AdminAuditLog.objects.create(
                actor=request.user,
                action=action_type,
                target_admin=None,
                details={
                    'subscription_id': str(sub.id),
                    'workspace_id': str(sub.workspace_id),
                    'workspace_name': sub.workspace.name,
                    'changes': changes
                }
            )

        return Response({
            'message': 'Subscription updated successfully',
            'subscription': {
                'id': str(sub.id),
                'status': sub.status,
                'plan_code': sub.plan.code,
                'cancel_at_period_end': sub.cancel_at_period_end,
                'trial_end': sub.trial_end.isoformat() if sub.trial_end else None,
                'current_period_end': sub.current_period_end.isoformat() if sub.current_period_end else None
            }
        })


class AdminSubscriptionCancelView(APIView):
    """
    Stage 9.2 Admin Console Subscription cancellation endpoint.
    POST: Requires MASTER or SUBSCRIPTIONS/CANCEL permission.
    """
    def get_permissions(self):
        return [HasAdminPermission(required_module="SUBSCRIPTIONS", required_action="CANCEL")()]

    def post(self, request, subscription_id):
        from .models import Subscription
        from django.utils import timezone

        try:
            sub = Subscription.objects.select_related('workspace', 'plan').get(id=subscription_id)
        except Subscription.DoesNotExist:
            return Response({'error': 'Subscription not found'}, status=status.HTTP_404_NOT_FOUND)

        if sub.status in ['CANCELED', 'EXPIRED']:
            return Response({'error': f"Subscription is already {sub.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # Immediate vs Period-End cancellation
        # If immediate=True is passed in request body, cancel right away (status -> CANCELED).
        # Otherwise, default to standard safe cancellation (cancel_at_period_end=True, or immediate if TRIALING).
        raw_immediate = request.data.get('immediate', False)
        if isinstance(raw_immediate, str):
            immediate = raw_immediate.lower() in ['true', '1', 'yes']
        else:
            immediate = bool(raw_immediate)

        reason = request.data.get('reason', 'Administrative cancellation')

        now = timezone.now()
        previous_status = sub.status
        previous_cancel_at_period_end = sub.cancel_at_period_end

        with transaction.atomic():
            if immediate or sub.status == 'TRIALING':
                sub.status = 'CANCELED'
                sub.cancel_at_period_end = False
                sub.canceled_at = now
                sub.save(update_fields=['status', 'cancel_at_period_end', 'canceled_at'])
            else:
                sub.cancel_at_period_end = True
                sub.canceled_at = now
                sub.save(update_fields=['cancel_at_period_end', 'canceled_at'])

            AdminAuditLog.objects.create(
                actor=request.user,
                action='ADMIN_CANCEL_SUBSCRIPTION',
                target_admin=None,
                details={
                    'subscription_id': str(sub.id),
                    'workspace_id': str(sub.workspace_id),
                    'workspace_name': sub.workspace.name,
                    'immediate': immediate or previous_status == 'TRIALING',
                    'reason': reason,
                    'previous_status': previous_status,
                    'new_status': sub.status,
                    'previous_cancel_at_period_end': previous_cancel_at_period_end,
                    'new_cancel_at_period_end': sub.cancel_at_period_end
                }
            )

        return Response({
            'message': 'Subscription canceled successfully',
            'subscription': {
                'id': str(sub.id),
                'status': sub.status,
                'cancel_at_period_end': sub.cancel_at_period_end,
                'canceled_at': sub.canceled_at.isoformat() if sub.canceled_at else None
            }
        })


