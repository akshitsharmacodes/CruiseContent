import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LogOut, Save, User as UserIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Profile = () => {
  const { user, tier, accessToken, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    services_provided: '',
    physical_location_type: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/workspaces/profile/', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setFormData({
            business_name: data.business_name || '',
            owner_name: data.owner_name || '',
            services_provided: data.services_provided || '',
            physical_location_type: data.physical_location_type || '',
          });
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [accessToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('http://localhost:8000/api/workspaces/profile/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast.success("Profile updated successfully!");
      } else {
        toast.error("Failed to update profile.");
      }
    } catch (e) {
      toast.error("An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-20 w-20 rounded-full border-4 border-primary/20 overflow-hidden">
          <img 
            src={user?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
            alt="Profile"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{user?.email}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500 border border-amber-500/20">
              {tier} Tier
            </span>
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center">
          <UserIcon className="w-5 h-5 mr-2 text-primary" /> 
          Business Profile
        </h2>
        
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="business_name">Business Name</Label>
                <Input id="business_name" name="business_name" value={formData.business_name} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="owner_name">Owner Name</Label>
                <Input id="owner_name" name="owner_name" value={formData.owner_name} onChange={handleChange} />
              </div>
            </div>
            
            <div>
              <Label htmlFor="services_provided">Services Provided</Label>
              <Textarea 
                id="services_provided" 
                name="services_provided" 
                value={formData.services_provided} 
                onChange={handleChange} 
                className="min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="physical_location_type">Location Type (e.g. Remote, Office)</Label>
              <Input id="physical_location_type" name="physical_location_type" value={formData.physical_location_type} onChange={handleChange} />
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-destructive mb-2">Account Actions</h2>
        <p className="text-muted-foreground text-sm mb-4">Log out of your current session securely.</p>
        <Button variant="destructive" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </div>
  );
};

export default Profile;
