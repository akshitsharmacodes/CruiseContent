import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useApi from '@/hooks/useApi';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RotateCw } from 'lucide-react';
import AdminRolePermissions from './AdminRolePermissions';

export default function AdminRoleDialog({
  isOpen,
  onOpenChange,
  workspaceId,
  role = null, // null = create mode
  mode = 'create' // 'create' | 'edit' | 'view'
}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  // Fetch available permissions for this workspace
  const {
    data: permData,
    isLoading: isLoadingPerms,
    isError: isErrorPerms,
    error: errorPerms
  } = useQuery({
    queryKey: ['adminWorkspaceAvailablePermissions', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const res = await api.get(`/auth/admin/workspaces/${workspaceId}/available-permissions/`);
      return res.data;
    },
    enabled: isOpen && !!workspaceId,
  });

  // Populate form on role change
  useEffect(() => {
    if (role && (mode === 'edit' || mode === 'view')) {
      setFormName(role.name || '');
      setFormDescription(role.description || '');
      setSelectedPermissions(role.permissions || []);
    } else {
      setFormName('');
      setFormDescription('');
      setSelectedPermissions([]);
    }
  }, [role, mode, isOpen]);

  // Create Mutation
  const createRoleMutation = useMutation({
    mutationFn: async (payload) => {
      return api.post(`/auth/admin/workspaces/${workspaceId}/roles/`, payload);
    },
    onSuccess: () => {
      toast.success('Custom role created successfully');
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaceRoles', workspaceId] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to create roles.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to create custom role');
      }
    }
  });

  // Update Mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (payload) => {
      return api.patch(`/auth/admin/workspaces/${workspaceId}/roles/${role.id}/`, payload);
    },
    onSuccess: () => {
      toast.success('Custom role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaceRoles', workspaceId] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to update roles.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to update custom role');
      }
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Role name is required.');
      return;
    }

    const payload = {
      name: formName.trim(),
      description: formDescription.trim(),
      permissions: selectedPermissions
    };

    if (mode === 'edit') {
      updateRoleMutation.mutate(payload);
    } else {
      createRoleMutation.mutate(payload);
    }
  };

  const isReadOnly = mode === 'view';
  const isPending = createRoleMutation.isPending || updateRoleMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>
            {mode === 'create' && 'Create Custom Role'}
            {mode === 'edit' && 'Edit Custom Role'}
            {mode === 'view' && 'Role Details'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' && 'Define a dynamic role and assign software-level permissions for this workspace.'}
            {mode === 'edit' && 'Modify role name, description, and feature permissions.'}
            {mode === 'view' && 'View role configuration and assigned feature permissions.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
            {/* Identity Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">
                  Role Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="roleName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Marketing Lead, WhatsApp Operator, Content Specialist"
                  disabled={isReadOnly || isPending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleDescription">Description</Label>
                <Input
                  id="roleDescription"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the responsibilities of this role"
                  disabled={isReadOnly || isPending}
                />
              </div>
            </div>

            {/* Permissions Section */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold tracking-tight">Software & Feature Permissions</h4>
                  <p className="text-xs text-muted-foreground">
                    Only software entitled under the workspace subscription is available.
                  </p>
                </div>
              </div>

              {isLoadingPerms ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : isErrorPerms ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Failed to load available permissions: {errorPerms?.message || 'Error'}</span>
                </div>
              ) : (
                <AdminRolePermissions
                  availableSoftware={permData?.software || []}
                  selectedPermissions={selectedPermissions}
                  onChange={setSelectedPermissions}
                  readOnly={isReadOnly}
                />
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-3 border-t bg-muted/20">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {!isReadOnly && (
              <Button type="submit" disabled={isPending || isLoadingPerms}>
                {isPending && <RotateCw className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'edit' ? 'Save Changes' : 'Create Role'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
