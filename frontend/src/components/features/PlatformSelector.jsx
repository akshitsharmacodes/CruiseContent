import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function PlatformSelector({ platforms, handlePlatformToggle }) {
  const PLATFORMS = [
    { id: 'twitter', label: 'Twitter (X)' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' }
  ];

  return (
    <div className="flex gap-6 mb-6">
      {PLATFORMS.map((platform) => (
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
