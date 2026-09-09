import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, RotateCw, ServerCrash, Save, ShieldAlert, Shield, Plus, Undo2, MoreHorizontal, UserCog, Ban, Key, Trash2, CheckCircle2, Eye } from 'lucide-react';

export default function AdminAdmins() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  // Local state for editing permissions
  const [editedPermissions, setEditedPermissions] = useState({});

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Create Admin Form State
  const [createForm, setCreateForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: ''
  });
  
  // Disable Form State
  const [disableReason, setDisableReason] = useState('');
  
  // Reset Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete Confirmation State
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');

  // 1. Fetch Admins list
  const { data: admins, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminAdmins'],
    queryFn: async () => {
      try {
        const response = await api.get('/auth/admin/admins/');
        return response.data;
      } catch (err) {
        if (err.response?.status === 403) {
          navigate('/403');
        }
        throw err;
      }
    },
  });

  // 2. Fetch canonical modules for permissions
  const { data: modulesData } = useQuery({
    queryKey: ['adminPermissionModules'],
    queryFn: async () => {
      const response = await api.get('/auth/admin/permissions/modules/');
      return response.data.modules;
    },
  });

  // 3. Fetch specific admin's permissions when selected for edit/create
  const { 
    data: adminPermissions, 
    isLoading: isLoadingPermissions 
  } = useQuery({
    queryKey: ['adminPermissions', selectedAdmin?.id],
    queryFn: async () => {
      if (!selectedAdmin || selectedAdmin.admin_level === 'MASTER') return [];
      const response = await api.get(`/auth/admin/admins/${selectedAdmin.id}/permissions/`);
      return response.data;
    },
    enabled: !!selectedAdmin && selectedAdmin.admin_level !== 'MASTER' && isEditDialogOpen,
  });

  // Synchronize permissions state with fetched/cached data
  React.useEffect(() => {
    if (adminPermissions && isEditDialogOpen) {
      const initPerms = {};
      adminPermissions.forEach(p => {
        initPerms[p.module] = p.actions;
      });
      setEditedPermissions(initPerms);
    }
  }, [adminPermissions, isEditDialogOpen]);

  // Client-side filtering
  const filteredAdmins = useMemo(() => {
    if (!admins) return [];
    if (!searchQuery.trim()) return admins;
    
    const query = searchQuery.toLowerCase();
    return admins.filter(admin => {
      const emailMatch = admin.email?.toLowerCase().includes(query);
      const nameMatch = `${admin.first_name || ''} ${admin.last_name || ''}`.toLowerCase().includes(query);
      return emailMatch || nameMatch;
    });
  }, [admins, searchQuery]);

  // Mutations
  const createAdminMutation = useMutation({
    mutationFn: async (payload) => api.post('/auth/admin/admins/', payload),
    onSuccess: async () => {
      toast.success('Admin identity created successfully with assigned permissions.');
      queryClient.invalidateQueries({ queryKey: ['adminAdmins'] });
      setIsCreateDialogOpen(false);
      resetCreateForm();
    },
    onError: (err) => {
      toast.error('Failed to create admin: ' + (err.response?.data?.error || err.message));
    }
  });

  const savePermissionsMutation = useMutation({
    mutationFn: async (payload) => {
      return api.patch(`/auth/admin/admins/${selectedAdmin.id}/permissions/`, payload);
    },
    onSuccess: () => {
      toast.success('Permissions updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['adminPermissions', selectedAdmin.id] });
      setIsEditDialogOpen(false);
    },
    onError: (err) => {
      toast.error('Failed to update permissions: ' + (err.response?.data?.error || err.message));
    }
  });

  const lifecycleMutation = useMutation({
    mutationFn: async ({ adminId, data }) => {
      return api.patch(`/auth/admin/admins/${adminId}/`, data);
    },
    onSuccess: () => {
      toast.success('Admin status updated.');
      queryClient.invalidateQueries({ queryKey: ['adminAdmins'] });
      setIsDisableDialogOpen(false);
      setIsActivateDialogOpen(false);
    },
    onError: (err) => {
      toast.error('Failed to update admin: ' + (err.response?.data?.error || err.message));
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ adminId, password }) => {
      return api.post(`/auth/admin/admins/${adminId}/reset-password/`, { password });
    },
    onSuccess: () => {
      toast.success('Password reset successfully.');
      setIsResetPasswordDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      toast.error('Failed to reset password: ' + (err.response?.data?.error || err.message));
    }
  });

  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId) => {
      return api.delete(`/auth/admin/admins/${adminId}/`);
    },
    onSuccess: () => {
      toast.success('Admin deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['adminAdmins'] });
      setIsDeleteDialogOpen(false);
      setDeleteConfirmEmail('');
    },
    onError: (err) => {
      toast.error('Failed to delete admin: ' + (err.response?.data?.error || err.message));
    }
  });

  // Handlers
  const handleOpenEdit = (admin) => {
    setSelectedAdmin(admin);
    setEditedPermissions({});
    setIsEditDialogOpen(true);
  };

  const handleOpenCreate = () => {
    resetCreateForm();
    setEditedPermissions({});
    setIsCreateDialogOpen(true);
  };

  const resetCreateForm = () => {
    setCreateForm({ email: '', first_name: '', last_name: '', password: '' });
  };

  const submitCreateAdmin = () => {
    if (!createForm.email.trim()) {
      toast.error('Email is required.');
      return;
    }
    const permissionsPayload = Object.entries(editedPermissions)
      .filter(([_, actions]) => actions && actions.length > 0)
      .map(([moduleName, actions]) => ({
        module: moduleName,
        actions: actions,
        is_active: true
      }));

    createAdminMutation.mutate({
      ...createForm,
      permissions: permissionsPayload
    });
  };

  const handleSavePermissions = () => {
    if (!selectedAdmin) return;
    const payload = Object.entries(editedPermissions).map(([moduleName, actions]) => ({
      module: moduleName,
      actions: actions,
      is_active: true
    }));
    savePermissionsMutation.mutate(payload);
  };

  const toggleAction = (moduleName, actionName) => {
    setEditedPermissions(prev => {
      const moduleActions = prev[moduleName] || [];
      const newActions = moduleActions.includes(actionName)
        ? moduleActions.filter(a => a !== actionName)
        : [...moduleActions, actionName];
      return { ...prev, [moduleName]: newActions };
    });
  };

  const renderPermissionsMatrix = (isMaster) => {
    if (isMaster) {
      return (
        <div className="rounded-md border p-6 bg-muted/20 text-center">
          <ShieldAlert className="w-8 h-8 text-primary mx-auto mb-2 opacity-80" />
          <p className="font-medium">Unrestricted Access</p>
          <p className="text-sm text-muted-foreground mt-1">
            MASTER level admins inherently have all system permissions.
          </p>
        </div>
      );
    }

    if (!modulesData) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(modulesData).map(([moduleName, availableActions]) => {
          const currentActions = editedPermissions[moduleName] || [];
          return (
            <Card key={moduleName}>
              <CardHeader className="py-2 px-4 bg-muted/20 border-b">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {moduleName}
                  <Badge variant={currentActions.length > 0 ? "default" : "secondary"}>
                    {currentActions.length} / {availableActions.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 flex flex-wrap gap-4">
                {availableActions.map((action) => {
                  const isChecked = currentActions.includes(action);
                  return (
                    <div key={action} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`${moduleName}-${action}`} 
                        checked={isChecked}
                        onCheckedChange={() => toggleAction(moduleName, action)}
                      />
                      <label
                        htmlFor={`${moduleName}-${action}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {action}
                      </label>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (isError) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-dashed text-center">
        <ServerCrash className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Failed to load admin list</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error.response?.data?.error || error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RotateCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Management</h2>
          <p className="text-muted-foreground">
            Manage Admin profiles and assign module permissions.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin Directory</CardTitle>
            <div className="flex items-center gap-2 w-full max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name or email..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !admins || admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No Admins Found</p>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No matching admins</p>
              <p className="text-sm text-muted-foreground">Try adjusting your search query.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin User</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdmins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {(admin.first_name || admin.last_name) 
                              ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() 
                              : 'Unknown Name'}
                          </span>
                          <span className="text-xs text-muted-foreground">{admin.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {admin.admin_level === 'MASTER' ? (
                          <Badge className="bg-primary"><ShieldAlert className="w-3 h-3 mr-1" /> MASTER</Badge>
                        ) : (
                          <Badge variant="outline"><Shield className="w-3 h-3 mr-1" /> ADMIN</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {admin.is_active ? (
                          <Badge variant="default" className="bg-green-600">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => handleOpenEdit(admin)}>
                              <Eye className="mr-2 h-4 w-4" /> View Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEdit(admin)}>
                              <UserCog className="mr-2 h-4 w-4" /> Edit Identity
                            </DropdownMenuItem>
                            {admin.admin_level !== 'MASTER' && (
                              <DropdownMenuItem onClick={() => handleOpenEdit(admin)}>
                                <Shield className="mr-2 h-4 w-4" /> Manage Permissions
                              </DropdownMenuItem>
                            )}

                            {admin.admin_level !== 'MASTER' && (
                              <>
                                <DropdownMenuSeparator />
                                {admin.is_active ? (
                                  <DropdownMenuItem
                                    className="text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400"
                                    onClick={() => { setSelectedAdmin(admin); setIsDisableDialogOpen(true); }}
                                  >
                                    <Ban className="mr-2 h-4 w-4" /> Disable Admin
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 dark:focus:text-emerald-400"
                                    onClick={() => { setSelectedAdmin(admin); setIsActivateDialogOpen(true); }}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Activate Admin
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => { setSelectedAdmin(admin); setIsResetPasswordDialogOpen(true); }}>
                                  <Key className="mr-2 h-4 w-4" /> Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => { setSelectedAdmin(admin); setIsDeleteDialogOpen(true); }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Admin
                                </DropdownMenuItem>
                              </>
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

      {/* ---------------- CREATE ADMIN DIALOG ---------------- */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>Create Admin</DialogTitle>
            <DialogDescription>
              Create a new ADMIN and assign module permissions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground mb-3">Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input 
                    value={createForm.first_name} 
                    onChange={e => setCreateForm({...createForm, first_name: e.target.value})} 
                    disabled={createAdminMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input 
                    value={createForm.last_name} 
                    onChange={e => setCreateForm({...createForm, last_name: e.target.value})} 
                    disabled={createAdminMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input 
                    type="email"
                    value={createForm.email} 
                    onChange={e => setCreateForm({...createForm, email: e.target.value})} 
                    disabled={createAdminMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input 
                    type="password"
                    placeholder="Leave blank to send setup email"
                    value={createForm.password} 
                    onChange={e => setCreateForm({...createForm, password: e.target.value})} 
                    disabled={createAdminMutation.isPending}
                  />
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground mb-3">Permissions</h3>
              {renderPermissionsMatrix(false)}
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitCreateAdmin} disabled={createAdminMutation.isPending}>
              {createAdminMutation.isPending && <RotateCw className="mr-2 h-4 w-4 animate-spin" />}
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- EDIT ADMIN DIALOG ---------------- */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <DialogTitle>Admin Details</DialogTitle>
            <DialogDescription>
              View identity and manage permissions for {selectedAdmin?.email}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            {selectedAdmin && (
              <>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground mb-3">Identity</h3>
                  <div className="grid grid-cols-2 gap-4 rounded-md border p-4 bg-muted/20">
                    <div>
                      <h5 className="text-xs text-muted-foreground mb-1">Name</h5>
                      <p className="text-sm font-medium">
                        {(selectedAdmin.first_name || selectedAdmin.last_name) 
                          ? `${selectedAdmin.first_name || ''} ${selectedAdmin.last_name || ''}`.trim() 
                          : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-xs text-muted-foreground mb-1">Email</h5>
                      <p className="text-sm break-all">{selectedAdmin.email}</p>
                    </div>
                    <div>
                      <h5 className="text-xs text-muted-foreground mb-1">Level</h5>
                      {selectedAdmin.admin_level === 'MASTER' ? (
                        <Badge className="bg-primary">MASTER</Badge>
                      ) : (
                        <Badge variant="outline">ADMIN</Badge>
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs text-muted-foreground mb-1">Status</h5>
                      {selectedAdmin.is_active ? (
                        <Badge variant="default" className="bg-green-600">Active</Badge>
                      ) : (
                        <div className="flex flex-col">
                          <Badge variant="secondary" className="w-fit">Disabled</Badge>
                          {selectedAdmin.disabled_reason && (
                            <span className="text-xs text-muted-foreground mt-1">Reason: {selectedAdmin.disabled_reason}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="text-xs text-muted-foreground mb-1">Created At</h5>
                      <p className="text-sm">{selectedAdmin.created_at ? new Date(selectedAdmin.created_at).toLocaleString() : 'N/A'}</p>
                    </div>
                    <div>
                      <h5 className="text-xs text-muted-foreground mb-1">Last Login</h5>
                      <p className="text-sm">{selectedAdmin.last_login ? new Date(selectedAdmin.last_login).toLocaleString() : 'Never'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">Permissions</h3>
                  </div>
                  {renderPermissionsMatrix(selectedAdmin.admin_level === 'MASTER')}
                </div>
              </>
            )}
          </div>
          
          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Close</Button>
            {selectedAdmin?.admin_level !== 'MASTER' && (
              <Button onClick={handleSavePermissions} disabled={savePermissionsMutation.isPending || isLoadingPermissions}>
                {savePermissionsMutation.isPending && <RotateCw className="mr-2 h-4 w-4 animate-spin" />}
                Save Permissions
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- DISABLE ADMIN DIALOG ---------------- */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Admin?</DialogTitle>
            <DialogDescription>
              {selectedAdmin?.email} will lose access to the Admin Console.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Reason (Optional)</Label>
            <Input 
              placeholder="e.g. Offboarding" 
              value={disableReason} 
              onChange={e => setDisableReason(e.target.value)} 
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisableDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => lifecycleMutation.mutate({ adminId: selectedAdmin.id, data: { is_active: false, disabled_reason: disableReason }})} disabled={lifecycleMutation.isPending}>
              Disable Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- ACTIVATE ADMIN DIALOG ---------------- */}
      <Dialog open={isActivateDialogOpen} onOpenChange={setIsActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activate Admin?</DialogTitle>
            <DialogDescription>
              {selectedAdmin?.email} will regain access to the Admin Console.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => lifecycleMutation.mutate({ adminId: selectedAdmin.id, data: { is_active: true }})} disabled={lifecycleMutation.isPending}>
              Activate Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- RESET PASSWORD DIALOG ---------------- */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={(open) => {
        setIsResetPasswordDialogOpen(open);
        if (!open) { setNewPassword(''); setConfirmPassword(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedAdmin?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
                if (newPassword.length < 8) return toast.error("Password must be at least 8 characters");
                resetPasswordMutation.mutate({ adminId: selectedAdmin.id, password: newPassword });
              }} 
              disabled={resetPasswordMutation.isPending || !newPassword}
            >
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- DELETE ADMIN DIALOG ---------------- */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
        setIsDeleteDialogOpen(open);
        if (!open) setDeleteConfirmEmail('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Admin?</DialogTitle>
            <DialogDescription>
              This action is highly destructive and cannot be undone. It will remove the admin profile.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium mb-2">Admin: {selectedAdmin?.email}</p>
            <p className="text-sm text-muted-foreground mb-4">Type the email address to confirm.</p>
            <Input 
              value={deleteConfirmEmail} 
              onChange={e => setDeleteConfirmEmail(e.target.value)} 
              placeholder={selectedAdmin?.email}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteAdminMutation.mutate(selectedAdmin.id)} 
              disabled={deleteAdminMutation.isPending || deleteConfirmEmail !== selectedAdmin?.email}
            >
              Delete Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
