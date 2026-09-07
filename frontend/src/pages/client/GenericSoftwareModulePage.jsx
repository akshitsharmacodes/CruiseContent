import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Layers, Plus, Activity } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function GenericSoftwareModulePage({
  softwareCode,
  softwareName,
  description,
  features = []
}) {
  const { hasPermission } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{softwareName}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feat) => {
          const canView = hasPermission(softwareCode, feat.code, 'VIEW');
          const canCreate = hasPermission(softwareCode, feat.code, 'CREATE');

          if (!canView) return null;

          return (
            <Card key={feat.code}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{feat.name}</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{feat.description || `Manage ${feat.name}`}</p>
                {canCreate && (
                  <Button size="sm" variant="outline" className="w-full">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Create {feat.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Module Overview</CardTitle>
          <CardDescription>
            Active workspace service status and events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed rounded-lg">
            <Activity className="h-10 w-10 mb-2 opacity-50 text-primary" />
            <p className="font-medium text-sm">Service Ready</p>
            <p className="text-xs mt-1">Actions in this module are governed by your assigned custom role.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
