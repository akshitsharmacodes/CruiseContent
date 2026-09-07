import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import useApi from '@/hooks/useApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, AlertCircle, Edit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import AdminWorkspaceMembers from './AdminWorkspaceMembers';

export default function AdminWorkspaceDialog({ 
  workspace, 
  open, 
  onOpenChange,
  initialMode = 'view'
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(initialMode === 'edit');

  useEffect(() => {
    if (workspace && open) {
      setName(workspace.name || '');
      setError(null);
      setIsEditing(initialMode === 'edit');
    }
  }, [workspace, open, initialMode]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.patch(`/auth/admin/workspaces/${workspace.id}/`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Workspace updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaces'] });
      setIsEditing(false);
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        setError('You do not have permission to update workspaces.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to update workspace');
      }
    }
  });

  const handleSave = () => {
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    setError(null);
    updateMutation.mutate({ name: name.trim() });
  };

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle>
                {isEditing ? 'Edit Workspace' : 'Workspace Details'}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? 'Modify workspace settings and information.' : 'View workspace details and team members.'}
              </DialogDescription>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">ID</Label>
            <div className="col-span-3 text-sm font-mono bg-muted p-2 rounded break-all select-all">
              {workspace.id}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            {isEditing ? (
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                disabled={updateMutation.isPending}
                autoFocus
              />
            ) : (
              <div className="col-span-3 font-medium text-sm">
                {workspace.name}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Status</Label>
            <div className="col-span-3">
              {(workspace.status === 'ACTIVE' || (!workspace.status && workspace.is_active)) && (
                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                  Active
                </Badge>
              )}
              {workspace.status === 'SUSPENDED' && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-medium"
                >
                  Suspended
                </Badge>
              )}
              {workspace.status === 'ARCHIVED' && (
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700 font-medium"
                >
                  Archived
                </Badge>
              )}
              {!workspace.status && !workspace.is_active && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Created</Label>
            <div className="col-span-3 text-sm">
              {workspace.created_at ? new Date(workspace.created_at).toLocaleString() : 'N/A'}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right mt-1">Owner</Label>
            <div className="col-span-3 space-y-1 text-sm bg-muted/50 p-3 rounded">
              {workspace.owner ? (
                <>
                  <div className="font-medium">
                    {(workspace.owner.first_name || workspace.owner.last_name) 
                      ? `${workspace.owner.first_name || ''} ${workspace.owner.last_name || ''}`.trim() 
                      : 'Unknown Name'}
                  </div>
                  <div className="text-muted-foreground break-all">{workspace.owner.email}</div>
                  <div className="text-xs font-mono text-muted-foreground break-all select-all">{workspace.owner.id}</div>
                </>
              ) : (
                <span className="text-muted-foreground">No owner information</span>
              )}
            </div>
          </div>
          
          <div className="border-t my-4 pt-4">
            <h3 className="text-lg font-medium mb-4">Members</h3>
            <AdminWorkspaceMembers workspaceId={workspace.id} />
          </div>
        </div>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setName(workspace.name || '');
                  setIsEditing(false);
                  setError(null);
                }}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={updateMutation.isPending || name.trim() === workspace.name}
              >
                {updateMutation.isPending ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
