import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import useApi from '@/hooks/useApi';
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
  PauseCircle,
  PlayCircle,
  Archive,
  Trash2,
} from 'lucide-react';

import AdminWorkspaceDialog from '@/components/admin/AdminWorkspaceDialog';
import AdminCreateWorkspaceDialog from '@/components/admin/AdminCreateWorkspaceDialog';
import {
  AdminSuspendWorkspaceDialog,
  AdminActivateWorkspaceDialog,
  AdminArchiveWorkspaceDialog,
  AdminDeleteWorkspaceDialog,
} from '@/components/admin/AdminWorkspaceLifecycleDialogs';

export default function AdminWorkspaces() {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceDialogMode, setWorkspaceDialogMode] = useState('view');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'create' || location.state?.openCreate) {
      setIsCreateDialogOpen(true);
    }
  }, [location.search, location.state]);

  // Lifecycle dialog states
  const [suspendWorkspace, setSuspendWorkspace] = useState(null);
  const [activateWorkspace, setActivateWorkspace] = useState(null);
  const [archiveWorkspace, setArchiveWorkspace] = useState(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState(null);

  // Fetch workspaces using React Query
  const { data: workspaces, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['adminWorkspaces'],
    queryFn: async () => {
      try {
        const response = await api.get('/auth/admin/workspaces/');
        return response.data;
      } catch (err) {
        if (err.response?.status === 403) {
          navigate('/403');
        }
        throw err;
      }
    },
  });

  // Client-side filtering
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    if (!searchQuery.trim()) return workspaces;
    
    const query = searchQuery.toLowerCase();
    return workspaces.filter(ws => {
      const nameMatch = ws.name && ws.name.toLowerCase().includes(query);
      const idMatch = ws.id && ws.id.toLowerCase().includes(query);
      const statusMatch = (ws.status || (ws.is_active ? 'ACTIVE' : 'INACTIVE')).toLowerCase().includes(query);
      const ownerEmailMatch = ws.owner?.email && ws.owner.email.toLowerCase().includes(query);
      const ownerNameMatch = 
        (ws.owner?.first_name || ws.owner?.last_name) && 
        `${ws.owner.first_name || ''} ${ws.owner.last_name || ''}`.toLowerCase().includes(query);
        
      return nameMatch || idMatch || statusMatch || ownerEmailMatch || ownerNameMatch;
    });
  }, [workspaces, searchQuery]);

  const activeCount = workspaces?.filter(ws => (ws.status ? ws.status === 'ACTIVE' : ws.is_active)).length || 0;
  const suspendedCount = workspaces?.filter(ws => ws.status === 'SUSPENDED').length || 0;
  const totalMembers = workspaces?.reduce((sum, ws) => sum + (ws.member_count || 0), 0) || 0;

  const renderStatusBadge = (status, isActive) => {
    const currentStatus = status || (isActive ? 'ACTIVE' : 'INACTIVE');

    switch (currentStatus) {
      case 'ACTIVE':
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
            Active
          </Badge>
        );
      case 'SUSPENDED':
        return (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-medium"
          >
            Suspended
          </Badge>
        );
      case 'ARCHIVED':
        return (
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700 font-medium"
          >
            Archived
          </Badge>
        );
      default:
        return <Badge variant="secondary">{currentStatus}</Badge>;
    }
  };

  if (isError) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-dashed text-center">
        <ServerCrash className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Failed to load workspaces</h3>
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
          <h2 className="text-3xl font-bold tracking-tight">Workspaces</h2>
          <p className="text-muted-foreground">
            Manage and monitor workspaces across the platform.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workspace
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-2xl font-bold">{workspaces?.length || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
                {suspendedCount > 0 && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ({suspendedCount} suspended)
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">{totalMembers}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Workspace Directory</CardTitle>
            <div className="flex items-center gap-2 w-full max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search name, ID or owner..."
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
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !workspaces || workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No Workspaces Found</p>
              <p className="text-sm text-muted-foreground">
                There are currently no workspaces on the platform.
              </p>
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No matching workspaces</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search query.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWorkspaces.map((ws) => {
                    const wsStatus = ws.status || (ws.is_active ? 'ACTIVE' : 'INACTIVE');
                    return (
                      <TableRow 
                        key={ws.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell
                          className="font-medium cursor-pointer"
                          onClick={() => {
                            setWorkspaceDialogMode('view');
                            setSelectedWorkspace(ws);
                          }}
                        >
                          {ws.name}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => {
                            setWorkspaceDialogMode('view');
                            setSelectedWorkspace(ws);
                          }}
                        >
                          {ws.owner ? (
                            <div className="flex flex-col">
                              <span>
                                {(ws.owner.first_name || ws.owner.last_name) 
                                  ? `${ws.owner.first_name || ''} ${ws.owner.last_name || ''}`.trim() 
                                  : 'Unknown Name'}
                              </span>
                              <span className="text-xs text-muted-foreground">{ws.owner.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No Owner</span>
                          )}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => {
                            setWorkspaceDialogMode('view');
                            setSelectedWorkspace(ws);
                          }}
                        >
                          {ws.member_count}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => {
                            setWorkspaceDialogMode('view');
                            setSelectedWorkspace(ws);
                          }}
                        >
                          {renderStatusBadge(ws.status, ws.is_active)}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => {
                            setWorkspaceDialogMode('view');
                            setSelectedWorkspace(ws);
                          }}
                        >
                          {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 p-0 hover:bg-muted"
                                >
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  setWorkspaceDialogMode('view');
                                  setSelectedWorkspace(ws);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setWorkspaceDialogMode('edit');
                                  setSelectedWorkspace(ws);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>

                              {wsStatus === 'ACTIVE' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setSuspendWorkspace(ws)}
                                    className="text-amber-600 dark:text-amber-400 focus:text-amber-600 dark:focus:text-amber-400"
                                  >
                                    <PauseCircle className="mr-2 h-4 w-4" />
                                    Suspend
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setArchiveWorkspace(ws)}
                                    variant="destructive"
                                  >
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive
                                  </DropdownMenuItem>
                                </>
                              )}

                              {wsStatus === 'SUSPENDED' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setActivateWorkspace(ws)}
                                    className="text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 dark:focus:text-emerald-400"
                                  >
                                    <PlayCircle className="mr-2 h-4 w-4" />
                                    Activate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setArchiveWorkspace(ws)}
                                    variant="destructive"
                                  >
                                    <Archive className="mr-2 h-4 w-4" />
                                    Archive
                                  </DropdownMenuItem>
                                </>
                              )}

                              {/* Delete Workspace option for Master Admin */}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteWorkspace(ws)}
                                className="text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
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

      {/* Details / Edit Dialog */}
      <AdminWorkspaceDialog 
        workspace={selectedWorkspace}
        open={!!selectedWorkspace}
        onOpenChange={(val) => !val && setSelectedWorkspace(null)}
        initialMode={workspaceDialogMode}
      />

      {/* Create Workspace Dialog */}
      <AdminCreateWorkspaceDialog 
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* Suspend Confirmation Dialog */}
      <AdminSuspendWorkspaceDialog
        workspace={suspendWorkspace}
        open={!!suspendWorkspace}
        onOpenChange={(val) => !val && setSuspendWorkspace(null)}
      />

      {/* Activate Confirmation Dialog */}
      <AdminActivateWorkspaceDialog
        workspace={activateWorkspace}
        open={!!activateWorkspace}
        onOpenChange={(val) => !val && setActivateWorkspace(null)}
      />

      {/* Archive Confirmation Dialog */}
      <AdminArchiveWorkspaceDialog
        workspace={archiveWorkspace}
        open={!!archiveWorkspace}
        onOpenChange={(val) => !val && setArchiveWorkspace(null)}
      />

      {/* Delete Confirmation Dialog (Master Admin) */}
      <AdminDeleteWorkspaceDialog
        workspace={deleteWorkspace}
        open={!!deleteWorkspace}
        onOpenChange={(val) => !val && setDeleteWorkspace(null)}
      />
    </div>
  );
}
