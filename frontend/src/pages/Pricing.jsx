import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Check, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TIERS = [
  {
    name: 'STARTER',
    price: '₹1,999',
    rawPrice: 199900, // in paise
    description: 'Perfect for small businesses starting their AI journey.',
    features: ['15 AI Posts / Month', '3 Auto-Publishes / Month', 'Basic Analytics', 'Standard Support'],
  },
  {
    name: 'CREATOR',
    price: '₹4,999',
    rawPrice: 499900,
    description: 'For growing brands that need consistent content.',
    features: ['50 AI Posts / Month', '10 Auto-Publishes / Month', 'Advanced Analytics', 'Priority Support', 'Custom Brand Voice'],
    popular: true,
  },
  {
    name: 'PRO',
    price: '₹9,999',
    rawPrice: 999900,
    description: 'Unleash the full power of AI for your enterprise.',
    features: ['200 AI Posts / Month', '50 Auto-Publishes / Month', 'Dedicated Account Manager', 'API Access', 'White-label Reports'],
  }
];

export default function Pricing() {
  const { user, tier: currentTier, accessToken } = useAuth();
  const [loading, setLoading] = useState(null);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async (tierName, rawPrice) => {
    setLoading(tierName);
    
    try {
      const res = await fetch('http://localhost:8000/api/payments/create-order/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'Idempotency-Key': `${user.id}-${tierName}-${Date.now()}`
        },
        body: JSON.stringify({ tier: tierName, amount: rawPrice })
      });
      
      const orderData = await res.json();
      
      if (!res.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      const resScript = await loadRazorpayScript();
      
      if (!resScript) {
        toast.error('Failed to load Razorpay SDK');
        setLoading(null);
        return;
      }

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'SofricAI',
        description: `Upgrade to ${tierName} Tier`,
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            const verifyRes = await fetch('http://localhost:8000/api/payments/verify/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                transaction_id: orderData.id
              })
            });
            if (verifyRes.ok) {
              toast.success(`Successfully upgraded to ${tierName}!`);
              window.location.reload(); // Quick refresh to update global tier state
            } else {
              toast.error('Payment verification failed');
            }
          } catch (e) {
            toast.error('Error during verification');
          }
        },
        prefill: {
          email: user?.email,
        },
        theme: {
          color: '#3b82f6'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        toast.error('Payment Failed: ' + response.error.description);
      });
      rzp.open();

    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 mt-8 mb-16">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Simple, transparent pricing</h1>
        <p className="text-xl text-muted-foreground">
          Upgrade your workspace to unlock more AI generations and automated publishing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {TIERS.map((tier) => (
          <div 
            key={tier.name}
            className={`relative flex flex-col p-8 rounded-2xl border ${
              tier.popular 
                ? 'bg-card border-primary shadow-2xl shadow-primary/20 scale-105 z-10' 
                : 'bg-card/50 border-border'
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </span>
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
              <p className="text-muted-foreground text-sm h-10">{tier.description}</p>
            </div>
            
            <div className="mb-8">
              <span className="text-4xl font-extrabold">{tier.price}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <Check className="h-5 w-5 text-emerald-500 mr-3 shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            
            <Button 
              className="w-full" 
              variant={tier.popular ? 'default' : 'outline'}
              size="lg"
              disabled={currentTier === tier.name || loading === tier.name}
              onClick={() => handleUpgrade(tier.name, tier.rawPrice)}
            >
              {loading === tier.name ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : currentTier === tier.name ? (
                'Current Plan'
              ) : (
                'Upgrade Now'
              )}
            </Button>
          </div>
        ))}
      </div>
      
      <div className="mt-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        Payments securely processed by Razorpay. 100% money-back guarantee.
      </div>
    </div>
  );
}
