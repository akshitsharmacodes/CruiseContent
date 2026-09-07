import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import useApi from '@/hooks/useApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2, RotateCw, Plus, Shield, CheckCircle2 } from 'lucide-react';

export default function AdminUserDialog({ selectedUser, setSelectedUser, refetchUsers, initialMode = 'view' }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { adminLevel } = useAuth();
  const isMaster = adminLevel === 'MASTER';
  const isAdmin = adminLevel === 'ADMIN';

  // State for user edit
  const [editMode, setEditMode] = useState(initialMode === 'edit');
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '' });
  
  // State for adding workspace
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedRole, setSelectedRole] = useState('MEMBER');
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState('');

  useEffect(() => {
    if (selectedUser) {
      setEditForm({
        first_name: selectedUser.first_name || '',
        last_name: selectedUser.last_name || '',
        email: selectedUser.email || '',
      });
      setEditMode(initialMode === 'edit');
      setIsAddingWorkspace(false);
      setSelectedWorkspaceId('');
      setSelectedCustomRoleId('');
    }
  }, [selectedUser, initialMode]);

  // Fetch workspaces list for combobox
  const { data: allWorkspaces } = useQuery({
    queryKey: ['adminWorkspaces'],
    queryFn: async () => {
      const response = await api.get('/auth/admin/workspaces/');
      return response.data;
    },
    enabled: !!selectedUser && (isMaster || isAdmin),
  });

  // Fetch user's workspace memberships
  const { data: memberships, isLoading: loadingMemberships, refetch: refetchMemberships } = useQuery({
    queryKey: ['adminUserWorkspaces', selectedUser?.id],
    queryFn: async () => {
      const response = await api.get(`/auth/admin/users/${selectedUser.id}/workspaces/`);
      return response.data;
    },
    enabled: !!selectedUser && (isMaster || isAdmin),
    retry: false,
  });

  // Fetch roles for the newly selected workspace in "Add to Workspace" modal section
  const { data: addModalRoles } = useQuery({
    queryKey: ['adminWorkspaceRoles', selectedWorkspaceId],
    queryFn: async () => {
      if (!selectedWorkspaceId) return [];
      const res = await api.get(`/auth/admin/workspaces/${selectedWorkspaceId}/roles/`);
      return res.data.roles;
    },
    enabled: !!selectedWorkspaceId && isAddingWorkspace,
  });

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: async (payload) => api.patch(`/auth/admin/users/${selectedUser.id}/`, payload),
    onSuccess: (data) => {
      toast.success('User updated successfully');
      setEditMode(false);
      refetchUsers();
      setSelectedUser(data.data);
    },
    onError: (err) => {
      toast.error('Failed to update user: ' + (err.response?.data?.error || err.message));
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (statusVal) => api.patch(`/auth/admin/users/${selectedUser.id}/status/`, { status: statusVal }),
    onSuccess: () => {
      toast.success('Status updated successfully');
      refetchUsers();
    },
    onError: (err) => {
      toast.error('Failed to update status: ' + (err.response?.data?.error || err.message));
    }
  });

  const addMembershipMutation = useMutation({
    mutationFn: async (payload) => api.post(`/auth/admin/users/${selectedUser.id}/workspaces/`, payload),
    onSuccess: () => {
      toast.success('Workspace membership added');
      setIsAddingWorkspace(false);
      setSelectedWorkspaceId('');
      setSelectedCustomRoleId('');
      refetchMemberships();
    },
    onError: (err) => {
      toast.error('Failed to add membership: ' + (err.response?.data?.error || err.message));
    }
  });

  const changeMembershipMutation = useMutation({
    mutationFn: async ({ workspaceId, role, role_id }) => {
      const payload = {};
      if (role !== undefined) payload.role = role;
      if (role_id !== undefined) payload.role_id = role_id;
      return api.patch(`/auth/admin/users/${selectedUser.id}/workspaces/${workspaceId}/`, payload);
    },
    onSuccess: () => {
      toast.success('Membership updated successfully');
      refetchMemberships();
    },
    onError: (err) => {
      toast.error('Failed to update membership: ' + (err.response?.data?.error || err.message));
    }
  });

  const removeMembershipMutation = useMutation({
    mutationFn: async (workspaceId) => api.delete(`/auth/admin/users/${selectedUser.id}/workspaces/${workspaceId}/`),
    onSuccess: () => {
      toast.success('Membership removed successfully');
      refetchMemberships();
    },
    onError: (err) => {
      toast.error('Failed to remove membership: ' + (err.response?.data?.error || err.message));
    }
  });

  const handleUpdateUser = () => {
    updateUserMutation.mutate(editForm);
  };

  const handleAddWorkspace = () => {
    if (!selectedWorkspaceId) {
      toast.error('Please select a workspace');
      return;
    }
    addMembershipMutation.mutate({
      workspace_id: selectedWorkspaceId,
      role: selectedRole,
      role_id: selectedCustomRoleId || null
    });
  };

  const handleStatusChange = (newStatus) => {
    updateStatusMutation.mutate(newStatus);
  };

  if (!selectedUser) return null;

  const canEdit = isMaster || isAdmin;
  const currentStatusDisplay = selectedUser.is_active ? 'ACTIVE' : 'SUSPENDED';

  return (
    <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Management</DialogTitle>
          <DialogDescription>
            Manage details, workspaces, and custom role assignments for {selectedUser.email}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-8 pb-4">
          
          {/* User Details Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Profile Details</h3>
              {canEdit && !editMode && (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>Edit</Button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>First Name</Label>
                    <Input value={editForm.first_name} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Last Name</Label>
                    <Input value={editForm.last_name} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleUpdateUser} disabled={updateUserMutation.isPending}>
                    {updateUserMutation.isPending ? <RotateCw className="h-4 w-4 animate-spin mr-2"/> : null}
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Full Name</h4>
                  <p className="text-base font-medium">
                    {(selectedUser.first_name || selectedUser.last_name) 
                      ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() 
                      : 'Unknown'}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Email Address</h4>
                  <p className="text-base">{selectedUser.email}</p>
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Tier</h4>
                  <div>
                    <Badge variant={selectedUser.tier === 'FREE' ? 'outline' : 'default'}>
                      {selectedUser.tier}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">Date Joined</h4>
                  <p className="text-sm">
                    {selectedUser.date_joined ? new Date(selectedUser.date_joined).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
                
                <div className="space-y-1 col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">User ID</h4>
                  <p className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded break-all">
                    {selectedUser.id}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Status Management */}
          <section className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">Account Status</h3>
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Select
                  disabled={!canEdit || updateStatusMutation.isPending}
                  value={currentStatusDisplay}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                    <SelectItem value="DEACTIVATED">DEACTIVATED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {updateStatusMutation.isPending && <RotateCw className="h-4 w-4 animate-spin text-muted-foreground"/>}
            </div>
            <p className="text-sm text-muted-foreground">
              Suspending or deactivating a user will prevent them from logging in.
            </p>
          </section>

          {/* Workspace Memberships & Custom Roles */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Workspace Memberships & Roles</h3>
                <p className="text-xs text-muted-foreground">
                  Custom roles determine software, feature, and action access.
                </p>
              </div>
              {canEdit && !isAddingWorkspace && (
                <Button variant="outline" size="sm" onClick={() => setIsAddingWorkspace(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Workspace
                </Button>
              )}
            </div>

            {isAddingWorkspace && (
              <div className="border p-4 rounded-md space-y-4 bg-muted/20">
                <h4 className="text-sm font-medium">Add to Workspace</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Workspace</Label>
                    <Select
                      value={selectedWorkspaceId}
                      onValueChange={(wsId) => {
                        setSelectedWorkspaceId(wsId);
                        setSelectedCustomRoleId('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select workspace">
                          {allWorkspaces?.find(ws => ws.id === selectedWorkspaceId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {allWorkspaces?.map(ws => (
                          <SelectItem key={ws.id} value={ws.id} label={ws.name}>{ws.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Access Level</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="MEMBER">MEMBER</SelectItem>
                        <SelectItem value="VIEWER">VIEWER</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Role</Label>
                    <Select
                      value={selectedCustomRoleId}
                      onValueChange={setSelectedCustomRoleId}
                      disabled={!selectedWorkspaceId || !addModalRoles}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!selectedWorkspaceId ? "Select workspace first" : "Select custom role..."}>
                          {selectedCustomRoleId === 'none'
                            ? 'None (Standard)'
                            : addModalRoles?.find(r => r.id === selectedCustomRoleId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" label="None (Standard)">None (Standard)</SelectItem>
                        {addModalRoles?.map(r => (
                          <SelectItem key={r.id} value={r.id} label={r.name}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsAddingWorkspace(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddWorkspace} disabled={addMembershipMutation.isPending}>
                    {addMembershipMutation.isPending ? <RotateCw className="h-4 w-4 animate-spin mr-2"/> : null}
                    Add Membership
                  </Button>
                </div>
              </div>
            )}

            {loadingMemberships ? (
              <div className="flex justify-center p-4"><RotateCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : memberships && memberships.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workspace</TableHead>
                        <TableHead>Access</TableHead>
                        <TableHead>Custom Role</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberships.map((m) => (
                        <TableRow key={m.workspace_id}>
                          <TableCell className="font-medium">
                            <span className="font-medium text-foreground">{m.workspace_name}</span>
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={!canEdit || changeMembershipMutation.isPending || m.role === 'OWNER'}
                              value={m.role}
                              onValueChange={(newRole) => changeMembershipMutation.mutate({ workspaceId: m.workspace_id, role: newRole })}
                            >
                              <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue>{m.role}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {m.role === 'OWNER' && <SelectItem value="OWNER">OWNER</SelectItem>}
                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                                <SelectItem value="MEMBER">MEMBER</SelectItem>
                                <SelectItem value="VIEWER">VIEWER</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {m.custom_role ? (
                              <div className="flex items-center gap-1.5">
                                <Shield className="h-3.5 w-3.5 text-primary/70" />
                                <span className="text-xs font-medium">{m.custom_role.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={!canEdit || removeMembershipMutation.isPending || m.role === 'OWNER'}
                              onClick={() => {
                                if(window.confirm('Are you sure you want to remove this user from the workspace?')) {
                                  removeMembershipMutation.mutate(m.workspace_id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Read-Only Custom Role Permission Breakdown for active memberships */}
                {memberships.some(m => m.custom_role?.permissions?.length > 0) && (
                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Assigned Role Entitlements & Permissions
                    </h4>
                    {memberships.filter(m => m.custom_role).map(m => (
                      <div key={m.workspace_id} className="space-y-2 text-xs">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{m.workspace_name}</span>
                          <span className="text-muted-foreground">→</span>
                          <Badge variant="outline" className="text-[11px]">{m.custom_role.name}</Badge>
                        </div>
                        <div className="pl-4 space-y-1.5 border-l-2 border-primary/30">
                          {m.custom_role.permissions?.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{p.software?.replace(/_/g, ' ')}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-muted-foreground">{p.feature}</span>
                              <div className="flex gap-1 ml-2">
                                {p.actions?.map(act => (
                                  <Badge key={act} variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                                    {act}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-4 border rounded-md border-dashed text-sm text-muted-foreground">
                No workspace memberships found.
              </div>
            )}
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}

