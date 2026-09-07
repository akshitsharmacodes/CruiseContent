import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import useApi from '@/hooks/useApi';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  RotateCw,
  UserX,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  PauseCircle,
  PlayCircle,
  Shield,
  Building2,
} from 'lucide-react';
import AdminUserDialog from '@/components/admin/AdminUserDialog';

export default function AdminUsers() {
  const { adminLevel } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDialogMode, setUserDialogMode] = useState('view');

  // Create User dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    workspace_id: '',
    role_id: ''
  });

  // Fetch users using React Query
  const { data: users, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      try {
        const response = await api.get('/auth/admin/users/');
        return response.data;
      } catch (err) {
        if (err.response?.status === 403) {
          navigate('/403');
        }
        throw err;
      }
    },
  });

  // Fetch workspaces for create user dialog
  const { data: workspacesData } = useQuery({
    queryKey: ['adminWorkspaces'],
    queryFn: async () => {
      const res = await api.get('/auth/admin/workspaces/');
      return res.data;
    },
    enabled: isCreateDialogOpen,
  });

  // Fetch roles for the selected workspace in create user dialog
  const { data: workspaceRoles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['adminWorkspaceRoles', createForm.workspace_id],
    queryFn: async () => {
      if (!createForm.workspace_id || createForm.workspace_id === 'none') return [];
      const res = await api.get(`/auth/admin/workspaces/${createForm.workspace_id}/roles/`);
      return res.data.roles;
    },
    enabled: isCreateDialogOpen && !!createForm.workspace_id && createForm.workspace_id !== 'none',
  });

  // Selected role object for preview
  const selectedRolePreview = useMemo(() => {
    if (!workspaceRoles || !createForm.role_id || createForm.role_id === 'none') return null;
    return workspaceRoles.find(r => r.id === createForm.role_id);
  }, [workspaceRoles, createForm.role_id]);

  // Reset role selection when workspace changes
  const handleWorkspaceChange = (newWorkspaceId) => {
    setCreateForm(prev => ({
      ...prev,
      workspace_id: newWorkspaceId,
      role_id: 'none'
    }));
  };

  // Auto-select first workspace for ADMIN when create dialog opens
  useEffect(() => {
    if (isCreateDialogOpen && workspacesData && workspacesData.length > 0) {
      if (!createForm.workspace_id || (adminLevel === 'ADMIN' && createForm.workspace_id === 'none')) {
        const activeWs = workspacesData.find(w => w.status === 'ACTIVE') || workspacesData[0];
        setCreateForm(prev => ({
          ...prev,
          workspace_id: activeWs.id,
          role_id: 'none'
        }));
      }
    }
  }, [isCreateDialogOpen, workspacesData, adminLevel]);

  // Status mutation for direct row action
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }) => {
      return api.patch(`/auth/admin/users/${userId}/status/`, { status });
    },
    onSuccess: () => {
      toast.success('User status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to update user status.');
      } else {
        toast.error('Failed to update status: ' + (err.response?.data?.error || err.message));
      }
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (payload) => {
      const body = {
        email: payload.email.trim(),
        password: payload.password,
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
      };
      if (payload.workspace_id && payload.workspace_id !== 'none') {
        body.workspace_id = payload.workspace_id;
        if (payload.role_id && payload.role_id !== 'none') {
          body.role_id = payload.role_id;
        }
      }
      return api.post('/auth/admin/users/', body);
    },
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setIsCreateDialogOpen(false);
      setCreateForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        workspace_id: '',
        role_id: ''
      });
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        navigate('/403');
        return;
      }
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  });

  const submitCreateUser = () => {
    if (!createForm.email || !createForm.password) {
      toast.error('Email and password are required.');
      return;
    }
    if (createForm.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (adminLevel === 'ADMIN' && (!createForm.workspace_id || createForm.workspace_id === 'none')) {
      toast.error('Please select an assigned workspace for the user.');
      return;
    }
    createUserMutation.mutate(createForm);
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user => {
      const emailMatch = user.email && user.email.toLowerCase().includes(query);
      const nameMatch = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(query);
      return emailMatch || nameMatch;
    });
  }, [users, searchQuery]);

  if (isError) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-dashed text-center">
        <UserX className="h-10 w-10 text-muted-foreground" />
        <Button variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">
            Manage and view platform users, workspaces, and entitlement-aware custom roles.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Directory</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search users..."
                className="w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button variant="outline" size="icon" onClick={() => refetch()}><RotateCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <UserX className="h-8 w-8 mb-2" />
              <p className="text-sm">No users found matching your search query.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium cursor-pointer" onClick={() => { setSelectedUser(user); setUserDialogMode('view'); }}>
                        {(user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '—'}
                      </TableCell>
                      <TableCell className="cursor-pointer text-xs" onClick={() => { setSelectedUser(user); setUserDialogMode('view'); }}>
                        {user.email}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => { setSelectedUser(user); setUserDialogMode('view'); }}>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>{user.is_active ? 'ACTIVE' : 'SUSPENDED'}</Badge>
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => { setSelectedUser(user); setUserDialogMode('view'); }}>
                        <Badge variant={user.tier === 'FREE' ? 'outline' : 'secondary'}>{user.tier || 'FREE'}</Badge>
                      </TableCell>
                      <TableCell className="cursor-pointer text-xs text-muted-foreground" onClick={() => { setSelectedUser(user); setUserDialogMode('view'); }}>
                        {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-muted">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setUserDialogMode('view'); }}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setUserDialogMode('edit'); }}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.is_active ? (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, status: 'SUSPENDED' })}><PauseCircle className="mr-2 h-4 w-4" /> Suspend</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: user.id, status: 'ACTIVE' })}><PlayCircle className="mr-2 h-4 w-4" /> Activate</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdminUserDialog selectedUser={selectedUser} setSelectedUser={setSelectedUser} refetchUsers={refetch} initialMode={userDialogMode} />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Platform User</DialogTitle>
            <DialogDescription>Create a new user and optionally assign an entitlement-aware custom role.</DialogDescription>
          </DialogHeader>
          {adminLevel === 'ADMIN' && workspacesData && workspacesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Building2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-base">Create a Workspace First</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Users must be assigned to an authorized workspace. Create your first workspace to start adding team members.
                </p>
              </div>
              <Button
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  navigate('/admin/workspaces?action=create');
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Workspace
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="createFirstName">First Name</Label><Input id="createFirstName" value={createForm.first_name} onChange={e => setCreateForm({...createForm, first_name: e.target.value})} /></div>
                  <div className="space-y-2"><Label htmlFor="createLastName">Last Name</Label><Input id="createLastName" value={createForm.last_name} onChange={e => setCreateForm({...createForm, last_name: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="createEmail">Email Address <span className="text-destructive">*</span></Label><Input id="createEmail" type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} /></div>
                <div className="space-y-2"><Label htmlFor="createPassword">Password <span className="text-destructive">*</span></Label><Input id="createPassword" type="password" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} /></div>
                <div className="space-y-4 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold tracking-tight">Workspace & Custom Role</h4>
                      <p className="text-xs text-muted-foreground">Select a workspace and assign an entitlement-governed role.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Workspace</Label>
                      <Select value={createForm.workspace_id} onValueChange={handleWorkspaceChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select workspace...">
                            {createForm.workspace_id === 'none'
                              ? 'None (No Workspace)'
                              : workspacesData?.find(ws => ws.id === createForm.workspace_id)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {adminLevel !== 'ADMIN' && (
                            <SelectItem value="none" label="None (No Workspace)">None (No Workspace)</SelectItem>
                          )}
                          {workspacesData?.map(ws => <SelectItem key={ws.id} value={ws.id} label={ws.name}>{ws.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Custom Role</Label>
                      <Select value={createForm.role_id} onValueChange={(roleId) => setCreateForm(prev => ({ ...prev, role_id: roleId }))} disabled={!createForm.workspace_id || createForm.workspace_id === 'none' || isLoadingRoles}>
                        <SelectTrigger>
                          <SelectValue placeholder={!createForm.workspace_id || createForm.workspace_id === 'none' ? "Select workspace first" : "Select role..."}>
                            {createForm.role_id === 'none'
                              ? 'Standard Member (No Role)'
                              : workspaceRoles?.find(r => r.id === createForm.role_id)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" label="Standard Member (No Role)">Standard Member (No Role)</SelectItem>
                          {workspaceRoles?.map(r => <SelectItem key={r.id} value={r.id} label={r.name}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {createForm.workspace_id && createForm.workspace_id !== 'none' && !isLoadingRoles && (!workspaceRoles || workspaceRoles.length === 0) && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border/50">
                      <span>No custom roles created for this workspace yet. Defaulting to standard member.</span>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs font-medium text-primary hover:underline ml-2 shrink-0"
                        onClick={() => {
                          setIsCreateDialogOpen(false);
                          navigate('/admin/roles');
                        }}
                      >
                        + Create Role
                      </Button>
                    </div>
                  )}

                  {selectedRolePreview && (
                    <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> <span>Role Preview: <strong>{selectedRolePreview.name}</strong></span></div>
                      {selectedRolePreview.description && <p className="text-muted-foreground">{selectedRolePreview.description}</p>}
                      <div className="space-y-1.5 pt-1 border-t border-border/50">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Selected Software Access:</span>
                        {selectedRolePreview.permissions?.length === 0 ? (
                          <p className="text-muted-foreground">No specific feature permissions assigned.</p>
                        ) : (
                          selectedRolePreview.permissions?.map((p, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-foreground">{p.software?.replace(/_/g, ' ')}</span>
                              <span className="text-muted-foreground">/</span>
                              <span className="text-muted-foreground">{p.feature}:</span>
                              <div className="flex flex-wrap gap-1">
                                {p.actions?.map(act => (
                                  <Badge key={act} variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                                    {act}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="pt-2 border-t">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                <Button onClick={submitCreateUser} disabled={createUserMutation.isPending}>{createUserMutation.isPending && <RotateCw className="mr-2 h-4 w-4 animate-spin" />} Create User</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
