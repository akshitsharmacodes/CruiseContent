import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import useApi from '../../hooks/useApi';

const DEFAULT_PLATFORMS = [
  { id: 'twitter', backendEnum: 'TWITTER', label: 'Twitter (X)' },
  { id: 'facebook', backendEnum: 'FACEBOOK_PAGE', label: 'Facebook Page' },
  { id: 'instagram', backendEnum: 'INSTAGRAM', label: 'Instagram' },
  { id: 'linkedin', backendEnum: 'LINKEDIN', label: 'LinkedIn' },
  { id: 'whatsapp', backendEnum: 'WHATSAPP', label: 'WhatsApp' }
];

export default function PlatformSelector({ platforms = [], handlePlatformToggle }) {
  const api = useApi();
  const [connectedEnums, setConnectedEnums] = useState([]);

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await api.get('platform/connected/');
        const connected = response.data.connected_platforms || [];
        setConnectedEnums(connected.map(p => p.platform));
      } catch (error) {
        // Fallback gracefully without breaking selector
        console.warn("Could not fetch connected platforms", error);
      }
    };
    fetchPlatforms();
  }, [api]);

  const handleSelectAll = () => {
    DEFAULT_PLATFORMS.forEach(p => {
      if (!platforms.includes(p.id)) {
        handlePlatformToggle(p.id);
      }
    });
  };

  const handleClearAll = () => {
    DEFAULT_PLATFORMS.forEach(p => {
      if (platforms.includes(p.id)) {
        handlePlatformToggle(p.id);
      }
    });
  };

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Target Platforms ({platforms.length} selected)
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 text-primary hover:text-primary/80"
            onClick={handleSelectAll}
          >
            Select All
          </Button>
          <span className="text-muted-foreground text-xs">•</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={handleClearAll}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {DEFAULT_PLATFORMS.map((platform) => {
          const isSelected = platforms.includes(platform.id);
          const isConnected = connectedEnums.includes(platform.backendEnum) || 
            (platform.id === 'facebook' && connectedEnums.includes('FACEBOOK'));

          return (
            <div
              key={platform.id}
              onClick={() => handlePlatformToggle(platform.id)}
              className={`flex flex-col justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                  : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <Checkbox
                  id={`plat-${platform.id}`}
                  checked={isSelected}
                  onCheckedChange={() => handlePlatformToggle(platform.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                {isConnected ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    AI Ready
                  </Badge>
                )}
              </div>
              <Label
                htmlFor={`plat-${platform.id}`}
                className="text-xs font-semibold cursor-pointer truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {platform.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
