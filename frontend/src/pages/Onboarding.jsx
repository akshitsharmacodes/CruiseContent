import { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';

const Onboarding = () => {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    services_provided: '',
    physical_location_type: 'Remote',
    is_online_or_remote: true
  });

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/onboard/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        navigate('/dashboard', { replace: true });
      } else {
        console.error("Onboarding failed");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-lg border border-border overflow-hidden">
        <h2 className="text-2xl font-bold mb-2">Welcome to SofricAI</h2>
        <p className="text-muted-foreground mb-8">Let's set up your business profile so our AI can learn about you.</p>
        
        <div className="flex mb-8">
          <div className={`h-1 flex-1 rounded-l-full ${step >= 1 ? 'bg-primary' : 'bg-secondary'}`} />
          <div className={`h-1 flex-1 mx-1 ${step >= 2 ? 'bg-primary' : 'bg-secondary'}`} />
          <div className={`h-1 flex-1 rounded-r-full ${step >= 3 ? 'bg-primary' : 'bg-secondary'}`} />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold mb-4">The Basics</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="business_name">Business Name</Label>
                  <Input 
                    id="business_name" 
                    name="business_name" 
                    value={formData.business_name} 
                    onChange={handleChange} 
                    placeholder="e.g. Acme Corp" 
                  />
                </div>
                <div>
                  <Label htmlFor="owner_name">Your Name</Label>
                  <Input 
                    id="owner_name" 
                    name="owner_name" 
                    value={formData.owner_name} 
                    onChange={handleChange} 
                    placeholder="John Doe" 
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <Button onClick={handleNext} disabled={!formData.business_name}>Next Step</Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold mb-4">Operations</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="services_provided">What services do you provide?</Label>
                  <Textarea 
                    id="services_provided" 
                    name="services_provided" 
                    value={formData.services_provided} 
                    onChange={handleChange} 
                    placeholder="e.g. We provide web design and digital marketing services." 
                    className="min-h-[100px]"
                  />
                </div>
                <div>
                  <Label htmlFor="physical_location_type">Location Type</Label>
                  <Input 
                    id="physical_location_type" 
                    name="physical_location_type" 
                    value={formData.physical_location_type} 
                    onChange={handleChange} 
                    placeholder="e.g. Remote, Clinic, Office" 
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="outline" onClick={handleBack}>Back</Button>
                <Button onClick={handleNext} disabled={!formData.services_provided}>Next Step</Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold mb-4">You're all set!</h3>
              <p className="text-muted-foreground mb-6">
                We will now create your first Workspace for <strong>{formData.business_name}</strong>.
              </p>
              <div className="mt-8 flex justify-between">
                <Button variant="outline" onClick={handleBack}>Back</Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Workspace'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
