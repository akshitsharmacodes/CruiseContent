import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import useApi from '../../hooks/useApi';

export default function PlatformSelector({ platforms, handlePlatformToggle }) {
  const api = useApi();
  const [availablePlatforms, setAvailablePlatforms] = useState([]);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await api.get('platform/connected/');
        const connected = response.data.connected_platforms || [];
        
        // Map backend enums to frontend labels and lower-case IDs
        const mapping = {
          'TWITTER': { id: 'twitter', label: 'Twitter (X)' },
          'FACEBOOK_PAGE': { id: 'facebook', label: 'Facebook' },
          'FACEBOOK': { id: 'facebook', label: 'Facebook' },
          'INSTAGRAM': { id: 'instagram', label: 'Instagram' },
          'WHATSAPP': { id: 'whatsapp', label: 'WhatsApp' }
        };

        const formatted = connected.map(p => {
          const map = mapping[p.platform];
          return {
            id: map ? map.id : p.platform.toLowerCase(),
            label: map ? map.label : p.platform
          };
        });

        setAvailablePlatforms(formatted);
      } catch (error) {
        console.error("Failed to fetch connected platforms for selector", error);
      }
    };
    fetchPlatforms();
  }, [api]);

  if (availablePlatforms.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic mb-6">
        No platforms connected. Please connect a platform in the Platforms tab first.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-6 mb-6">
      {availablePlatforms.map((platform) => (
        <div key={platform.id} className="flex items-center space-x-2">
          <Checkbox 
            id={platform.id} 
            checked={platforms.includes(platform.id)}
            onCheckedChange={() => handlePlatformToggle(platform.id)}
          />
          <Label htmlFor={platform.id} className="text-sm font-medium cursor-pointer">
            {platform.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
