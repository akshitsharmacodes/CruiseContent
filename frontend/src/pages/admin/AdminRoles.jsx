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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  ServerCrash,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Shield,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import AdminRoleDialog from '@/components/admin/AdminRoleDialog';

export default function AdminRoles() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [activeRole, setActiveRole] = useState(null);
  const [roleDialogMode, setRoleDialogMode] = useState('create'); // 'create' | 'edit' | 'view'

  // Delete confirmation state
  const [roleToDelete, setRoleToDelete] = useState(null);

  // 1. Fetch All Workspaces
  const {
    data: workspacesData,
    isLoading: isLoadingWorkspaces,
    isError: isErrorWorkspaces,
    error: errorWorkspaces
  } = useQuery({
    queryKey: ['adminWorkspaces'],
    queryFn: async () => {
      try {
        const res = await api.get('/auth/admin/workspaces/');
        return res.data;
      } catch (err) {
        if (err.response?.status === 403) navigate('/403');
        throw err;
      }
    },
  });

  // Auto-select first active workspace if none selected
  React.useEffect(() => {
    if (workspacesData && workspacesData.length > 0 && !selectedWorkspaceId) {
      const activeWs = workspacesData.find(w => w.status === 'ACTIVE') || workspacesData[0];
      setSelectedWorkspaceId(activeWs.id);
    }
  }, [workspacesData, selectedWorkspaceId]);

  // 2. Fetch Custom Roles for Selected Workspace
  const {
    data: rolesData,
    isLoading: isLoadingRoles,
    isError: isErrorRoles,
    error: errorRoles,
    refetch: refetchRoles
  } = useQuery({
    queryKey: ['adminWorkspaceRoles', selectedWorkspaceId],
    queryFn: async () => {
      if (!selectedWorkspaceId) return [];
      try {
        const res = await api.get(`/auth/admin/workspaces/${selectedWorkspaceId}/roles/`);
        return res.data.roles;
      } catch (err) {
        if (err.response?.status === 403) navigate('/403');
        throw err;
      }
    },
    enabled: !!selectedWorkspaceId,
  });

  // 3. Delete Role Mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId) => {
      return api.delete(`/auth/admin/workspaces/${selectedWorkspaceId}/roles/${roleId}/`);
    },
    onSuccess: () => {
      toast.success('Custom role deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaceRoles', selectedWorkspaceId] });
      setRoleToDelete(null);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to delete roles.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete role');
      }
    }
  });

  // Filtered roles list
  const filteredRoles = useMemo(() => {
    if (!rolesData) return [];
    if (!searchQuery.trim()) return rolesData;

    const query = searchQuery.toLowerCase();
    return rolesData.filter(r =>
      r.name.toLowerCase().includes(query) ||
      (r.description && r.description.toLowerCase().includes(query))
    );
  }, [rolesData, searchQuery]);

  const handleOpenCreate = () => {
    if (!selectedWorkspaceId) {
      toast.error('Please select a workspace first.');
      return;
    }
    setActiveRole(null);
    setRoleDialogMode('create');
    setIsRoleDialogOpen(true);
  };

  const handleOpenEdit = (role) => {
    setActiveRole(role);
    setRoleDialogMode('edit');
    setIsRoleDialogOpen(true);
  };

  const handleOpenView = (role) => {
    setActiveRole(role);
    setRoleDialogMode('view');
    setIsRoleDialogOpen(true);
  };

  if (isErrorWorkspaces) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-dashed text-center">
        <ServerCrash className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Failed to load workspaces</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {errorWorkspaces.response?.data?.error || errorWorkspaces.message}
          </p>
        </div>
      </div>
    );
  }

  const selectedWorkspace = workspacesData?.find(w => w.id === selectedWorkspaceId);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Custom Roles</h2>
          <p className="text-muted-foreground">
            Manage workspace roles and feature-level permissions based on software entitlements.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {(!workspacesData || workspacesData.length === 0) ? (
            <Button onClick={() => navigate('/admin/workspaces?action=create')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace First
            </Button>
          ) : (
            <Button onClick={handleOpenCreate} disabled={!selectedWorkspaceId}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* Workspace Selector Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="w-full">
              <Label className="text-xs text-muted-foreground mb-1 block">Active Workspace</Label>
              <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId} disabled={!workspacesData || workspacesData.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={!workspacesData || workspacesData.length === 0 ? "No workspaces found" : "Select workspace..."}>
                    {selectedWorkspace?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workspacesData?.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} label={ws.name}>
                      <span className="font-medium">{ws.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({ws.status})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedWorkspace && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Workspace Status:</span>
              <Badge variant={selectedWorkspace.status === 'ACTIVE' ? 'default' : 'secondary'} className={selectedWorkspace.status === 'ACTIVE' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
                {selectedWorkspace.status}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roles Directory Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Role Directory</CardTitle>
              <CardDescription>
                Existing custom roles defined for this workspace.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[200px] sm:w-[250px] pl-8"
                  disabled={!selectedWorkspaceId || isLoadingRoles}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetchRoles()}
                title="Refresh"
                disabled={!selectedWorkspaceId || isLoadingRoles}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingRoles || isLoadingWorkspaces ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !workspacesData || workspacesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-lg font-medium">No workspaces available</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
                Custom roles are workspace-scoped. Create a workspace first before defining roles and permissions.
              </p>
              <Button onClick={() => navigate('/admin/workspaces?action=create')}>
                <Plus className="mr-2 h-4 w-4" /> Create Workspace
              </Button>
            </div>
          ) : isErrorRoles ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-2">
              <ServerCrash className="h-8 w-8 text-destructive" />
              <p className="text-sm">Failed to load roles: {errorRoles?.message || 'Error'}</p>
            </div>
          ) : !rolesData || rolesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-lg font-medium">No custom roles have been created yet.</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Define dynamic roles tailored to your team's access needs.
              </p>
              <Button onClick={handleOpenCreate} disabled={!selectedWorkspaceId}>
                <Plus className="mr-2 h-4 w-4" /> Create Role
              </Button>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium">No matching roles found.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Entitled Software</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role) => {
                    // Extract unique software modules assigned in this role
                    const softwareList = Array.from(new Set(role.permissions?.map(p => p.software) || []));

                    return (
                      <TableRow key={role.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell
                          className="font-medium cursor-pointer"
                          onClick={() => handleOpenView(role)}
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary/70" />
                            <span>{role.name}</span>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-xs truncate cursor-pointer"
                          onClick={() => handleOpenView(role)}
                        >
                          {role.description || '—'}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => handleOpenView(role)}
                        >
                          <div className="flex flex-wrap gap-1">
                            {softwareList.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : (
                              softwareList.map(sw => (
                                <Badge key={sw} variant="secondary" className="text-[11px] font-mono">
                                  {sw.replace(/_/g, ' ')}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground cursor-pointer"
                          onClick={() => handleOpenView(role)}
                        >
                          {role.created_at ? new Date(role.created_at).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 hover:bg-muted">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => handleOpenView(role)}>
                                <Eye className="mr-2 h-4 w-4" /> View Role
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(role)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setRoleToDelete(role)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Role
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit / View Centered Dialog */}
      <AdminRoleDialog
        isOpen={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        workspaceId={selectedWorkspaceId}
        role={activeRole}
        mode={roleDialogMode}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Delete Custom Role</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete the role <strong>{roleToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            This action cannot be undone. Users currently assigned to this role will lose its permissions.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleToDelete(null)} disabled={deleteRoleMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRoleMutation.mutate(roleToDelete?.id)}
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? 'Deleting...' : 'Delete Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
