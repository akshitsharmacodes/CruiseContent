import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Plus, Search, ShieldCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminCreateWorkspaceDialog({ 
  open, 
  onOpenChange 
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { user, adminLevel, currentWorkspaceId } = useAuth();
  const isMaster = adminLevel === 'MASTER';

  const [name, setName] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [error, setError] = useState(null);

  // Simple debounced search using local state for MASTER users
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const response = await api.get('/auth/admin/users/');
      return response.data;
    },
    enabled: open && isMaster,
  });

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    if (!ownerSearch.trim()) return users.slice(0, 50); // Show max 50 initially
    
    const query = ownerSearch.toLowerCase();
    return users.filter(u => 
      u.email.toLowerCase().includes(query) || 
      `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(query)
    ).slice(0, 50);
  }, [users, ownerSearch]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post(`/auth/admin/workspaces/`, data);
      return response.data;
    },
    onSuccess: async (createdWorkspace) => {
      toast.success('Workspace created successfully');
      queryClient.invalidateQueries(['adminWorkspaces']);
      
      // Automatically switch to the newly created workspace if none or as requested
      if (createdWorkspace?.id) {
        try {
          await api.post('/workspaces/switch/', { workspace_id: createdWorkspace.id });
        } catch (e) {
          console.error("Auto-switch error:", e);
        }
      }
      
      window.dispatchEvent(new Event('workspace-updated'));
      setName('');
      setOwnerSearch('');
      setSelectedOwnerId('');
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        setError('You do not have permission to create workspaces.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to create workspace');
      }
    }
  });

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    if (isMaster && !selectedOwnerId) {
      setError('An owner must be selected');
      return;
    }
    setError(null);
    const payload = { name: name.trim() };
    if (isMaster && selectedOwnerId) {
      payload.owner_id = selectedOwnerId;
    }
    createMutation.mutate(payload);
  };

  const resetForm = () => {
    setName('');
    setOwnerSearch('');
    setSelectedOwnerId('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && resetForm()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Create a new workspace and assign an initial owner.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="create-name">Workspace Name</Label>
            <Input
              id="create-name"
              placeholder="E.g. Acme Corp Workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={createMutation.isPending}
            />
          </div>

          {isMaster ? (
            <div className="space-y-2">
              <Label>Select Owner</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  className="pl-8"
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  disabled={createMutation.isPending}
                />
              </div>
              
              <div className="border rounded-md mt-2 h-[200px]">
                <ScrollArea className="h-full p-2">
                  {isLoadingUsers ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No users found matching "{ownerSearch}"
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredUsers.map(user => (
                        <div 
                          key={user.id}
                          className={`p-2 rounded cursor-pointer border ${
                            selectedOwnerId === user.id 
                              ? 'bg-primary/10 border-primary' 
                              : 'hover:bg-muted border-transparent'
                          }`}
                          onClick={() => setSelectedOwnerId(user.id)}
                        >
                          <div className="font-medium text-sm">
                            {(user.first_name || user.last_name) 
                              ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                              : 'Unknown Name'}
                          </div>
                          <div className="text-xs text-muted-foreground break-all">{user.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace Creator & Manager</span>
                <Badge variant="outline" className="text-[10px] font-mono">ADMIN</Badge>
              </div>
              <div className="flex items-center gap-2 pt-1 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>{user?.email || 'You (Authenticated Admin)'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                You will automatically be assigned as the manager of this workspace with full delegated administrative access.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetForm} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={createMutation.isPending || !name.trim() || (isMaster && !selectedOwnerId)}
          >
            {createMutation.isPending ? (
              'Creating...'
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Workspace
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
