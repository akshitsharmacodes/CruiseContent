import uuid
import hmac
import hashlib
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import PaymentTransaction

try:
    import razorpay
except ImportError:
    razorpay = None

class CreateRazorpayOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target_tier = request.data.get('tier')
        amount = request.data.get('amount') # in paise
        
        if not target_tier or not amount:
            return Response({'error': 'Tier and amount are required'}, status=status.HTTP_400_BAD_REQUEST)

        idempotency_key = request.headers.get('Idempotency-Key')
        
        # Check idempotency: If we already have this key, return the existing order
        if idempotency_key:
            existing_tx = PaymentTransaction.objects.filter(idempotency_key=idempotency_key, user=request.user).first()
            if existing_tx:
                if existing_tx.status == 'SUCCESSFUL':
                    return Response({'error': 'Do not pay it again.'}, status=status.HTTP_400_BAD_REQUEST)
                return Response({
                    'order_id': existing_tx.gateway_order_id,
                    'amount': existing_tx.amount,
                    'currency': existing_tx.currency,
                    'id': str(existing_tx.id)
                })

        # Initialize Transaction
        tx = PaymentTransaction.objects.create(
            user=request.user,
            target_tier=target_tier,
            amount=amount,
            idempotency_key=idempotency_key
        )

        # Connect to Razorpay
        key_id = getattr(settings, 'RAZORPAY_KEY_ID', 'test_key')
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'test_secret')
        
        if razorpay:
            client = razorpay.Client(auth=(key_id, key_secret))
            client.set_app_details({"title": "Django", "version": "5.2.16"})
            order_data = {
                'amount': amount,
                'currency': 'INR',
                'receipt': str(tx.id),
                'payment_capture': 1
            }
            try:
                razorpay_order = client.order.create(data=order_data)
                tx.gateway_order_id = razorpay_order['id']
                tx.save()
            except Exception as e:
                tx.status = 'FAILED'
                tx.save()
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Mock for development without the SDK installed
            tx.gateway_order_id = f"order_mock_{uuid.uuid4().hex[:10]}"
            tx.save()

        return Response({
            'order_id': tx.gateway_order_id,
            'amount': tx.amount,
            'currency': tx.currency,
            'id': str(tx.id),
            'key': key_id
        })


class VerifyRazorpayPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature = request.data.get('razorpay_signature')
        internal_tx_id = request.data.get('transaction_id')
        
        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature, internal_tx_id]):
            return Response({'error': 'Missing required payment parameters'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tx = PaymentTransaction.objects.get(id=internal_tx_id, user=request.user)
        except PaymentTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)

        if tx.status == 'SUCCESSFUL':
            # Idempotency / Double Webhook protection
            return Response({'message': 'Already processed'})

        key_id = getattr(settings, 'RAZORPAY_KEY_ID', 'test_key')
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', 'test_secret')

        if razorpay:
            client = razorpay.Client(auth=(key_id, key_secret))
            try:
                if key_secret != 'test_secret':
                    client.utility.verify_payment_signature({
                        'razorpay_order_id': razorpay_order_id,
                        'razorpay_payment_id': razorpay_payment_id,
                        'razorpay_signature': razorpay_signature
                    })
                # Payment Valid!
                tx.status = 'SUCCESSFUL'
                tx.gateway_payment_id = razorpay_payment_id
                tx.gateway_signature = razorpay_signature
                tx.save()
                
                # Upgrade the user's tier
                profile = request.user.profile
                profile.tier = tx.target_tier
                profile.save()
                
                return Response({'message': 'Payment successful and tier upgraded'})
            except Exception as e:
                tx.status = 'FAILED'
                tx.save()
                return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Fallback (e.g. tests without Razorpay SDK)
            tx.status = 'SUCCESSFUL'
            tx.gateway_payment_id = razorpay_payment_id
            tx.gateway_signature = razorpay_signature
            tx.save()
            profile = request.user.profile
            profile.tier = tx.target_tier
            profile.save()
            return Response({'message': 'Payment successful (mock)'})

class RazorpayWebhookView(APIView):
    permission_classes = [] # Webhooks don't have user authentication

    def post(self, request):
        webhook_signature = request.headers.get('X-Razorpay-Signature')
        webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', 'test_webhook_secret')
        
        if not webhook_signature:
            return Response({'error': 'Missing signature'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not razorpay:
            return Response({'error': 'Razorpay SDK not found'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        client = razorpay.Client(auth=(getattr(settings, 'RAZORPAY_KEY_ID', ''), getattr(settings, 'RAZORPAY_KEY_SECRET', '')))
        
        try:
            client.utility.verify_webhook_signature(
                request.body.decode('utf-8'),
                webhook_signature,
                webhook_secret
            )
        except Exception as e:
            return Response({'error': 'Invalid webhook signature'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse the webhook payload
        payload = request.data
        event = payload.get('event')
        
        if event == 'order.paid':
            payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
            order_id = payment_entity.get('order_id')
            payment_id = payment_entity.get('id')
            
            # Find the transaction by gateway_order_id
            tx = PaymentTransaction.objects.filter(gateway_order_id=order_id).first()
            if tx and tx.status != 'SUCCESSFUL':
                tx.status = 'SUCCESSFUL'
                tx.gateway_payment_id = payment_id
                tx.save()
                
                # Upgrade user's tier
                profile = tx.user.profile
                profile.tier = tx.target_tier
                profile.save()
                
        return Response({'status': 'ok'})
