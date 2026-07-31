import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    owner_name: '',
    business_name: '',
    established_date: '',
    opening_hours: '',
    operational_procedures: '',
    is_online_or_remote: false,
    physical_location_type: '',
    services_provided: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (checked) => {
    setFormData(prev => ({ ...prev, is_online_or_remote: checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:8000/api/workspaces/profile/', formData);
      toast.success('Business Profile created! You are ready to generate posts.');
      navigate('/');
    } catch (error) {
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 lg:p-12">
      <Card className="w-full max-w-2xl shadow-none border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">Tell us about your business</CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            This context will be injected into our AI to ensure your generated posts perfectly match your brand's voice and operations.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-foreground">Owner Name</label>
                <Input name="owner_name" value={formData.owner_name} onChange={handleChange} placeholder="Jane Doe" required className="bg-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-foreground">Business Name</label>
                <Input name="business_name" value={formData.business_name} onChange={handleChange} placeholder="Acme Corp" required className="bg-transparent" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">Services Provided</label>
              <Textarea name="services_provided" value={formData.services_provided} onChange={handleChange} placeholder="We specialize in architectural drafting, interior design..." required className="bg-transparent min-h-[100px]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-foreground">Established Date</label>
                <Input name="established_date" type="date" value={formData.established_date} onChange={handleChange} className="bg-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-foreground">Physical Location Type</label>
                <Input name="physical_location_type" value={formData.physical_location_type} onChange={handleChange} placeholder="Clinic, Shop, Office, etc." className="bg-transparent" />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="remote" checked={formData.is_online_or_remote} onCheckedChange={handleCheckbox} />
              <label htmlFor="remote" className="text-sm font-medium leading-none">
                We operate fully online / remotely.
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">Opening Hours</label>
              <Input name="opening_hours" value={formData.opening_hours} onChange={handleChange} placeholder="Mon-Fri: 9AM - 5PM, Sat-Sun: Closed" className="bg-transparent" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">Operational Procedures & Guidelines</label>
              <Textarea name="operational_procedures" value={formData.operational_procedures} onChange={handleChange} placeholder="Any specific rules, booking procedures, or guidelines customers should know..." className="bg-transparent min-h-[100px]" />
            </div>

          </CardContent>
          <CardFooter className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
              {loading ? 'Saving...' : 'Complete Onboarding'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
