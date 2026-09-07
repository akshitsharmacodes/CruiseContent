import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import useApi from '@/hooks/useApi';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserPlus, MoreHorizontal, Trash2, Shield, Crown, User as UserIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

// Helper for badges
function RoleBadge({ role }) {
  switch (role) {
    case 'OWNER':
      return <Badge className="bg-purple-600 hover:bg-purple-700 flex items-center gap-1"><Crown className="w-3 h-3" /> OWNER</Badge>;
    case 'ADMIN':
      return <Badge className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1"><Shield className="w-3 h-3" /> ADMIN</Badge>;
    case 'MEMBER':
      return <Badge variant="secondary" className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> MEMBER</Badge>;
    case 'VIEWER':
      return <Badge variant="outline">VIEWER</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}

export default function AdminWorkspaceMembers({ workspaceId }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  
  // Modals state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState(null);

  // Fetch Members
  const { data: members, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-workspace-members', workspaceId],
    queryFn: async () => {
      const response = await api.get(`/auth/admin/workspaces/${workspaceId}/members/`);
      return response.data;
    },
    enabled: !!workspaceId,
    retry: 1
  });

  const filteredMembers = React.useMemo(() => {
    if (!members) return [];
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(m => 
      m.user.email.toLowerCase().includes(q) ||
      `${m.user.first_name || ''} ${m.user.last_name || ''}`.toLowerCase().includes(q)
    );
  }, [members, search]);

  // Mutations
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      await api.patch(`/auth/admin/users/${userId}/workspaces/${workspaceId}/`, { role });
    },
    onSuccess: () => {
      toast.success('Member role updated');
      queryClient.invalidateQueries(['admin-workspace-members', workspaceId]);
      setRoleDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update member role');
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (userId) => {
      await api.delete(`/auth/admin/users/${userId}/workspaces/${workspaceId}/`);
    },
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries(['admin-workspace-members', workspaceId]);
      setRemoveDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  });

  // Handlers
  const handleOpenRoleDialog = (member) => {
    setSelectedMember(member);
    setRoleDialogOpen(true);
  };

  const handleOpenRemoveDialog = (member) => {
    setSelectedMember(member);
    setRemoveDialogOpen(true);
  };

  if (isError) {
    if (error?.response?.status === 403) {
      return (
        <div className="text-center py-6 text-muted-foreground text-sm border rounded bg-muted/20">
          You do not have permission to view workspace members.
        </div>
      );
    }
    return (
      <div className="text-center py-6 text-red-600 text-sm border rounded bg-red-50/50">
        Failed to load members. 
        <Button variant="link" size="sm" onClick={() => refetch()} className="ml-2">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Add Member
        </Button>
      </div>

      <div className="border rounded-md">
        <ScrollArea className="h-[250px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.membership_id}>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {(member.user.first_name || member.user.last_name)
                          ? `${member.user.first_name || ''} ${member.user.last_name || ''}`.trim()
                          : 'Unknown Name'}
                      </div>
                      <div className="text-xs text-muted-foreground">{member.user.email}</div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleOpenRoleDialog(member)}
                        >
                          Change Role
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleOpenRemoveDialog(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              Update role for {selectedMember?.user?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].map((role) => (
              <Button
                key={role}
                variant={selectedMember?.role === role ? "default" : "outline"}
                className="justify-start h-12"
                disabled={selectedMember?.role === role || updateRoleMutation.isPending}
                onClick={() => updateRoleMutation.mutate({ userId: selectedMember.user.id, role })}
              >
                <RoleBadge role={role} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {selectedMember?.role === role ? 'Current Role' : 'Select'}
                </span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Remove Member?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMember?.user?.email} from this workspace?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} disabled={removeMutation.isPending}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => removeMutation.mutate(selectedMember?.user?.id)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      {addDialogOpen && (
        <AddMemberDialog 
          workspaceId={workspaceId}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
        />
      )}
    </div>
  );
}

// Add Member Component (internal)
function AddMemberDialog({ workspaceId, open, onOpenChange }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('MEMBER');

  // Search users globally to add to workspace
  const { data: users, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const response = await api.get('/auth/admin/users/');
      return response.data;
    },
    enabled: open
  });

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    if (!userSearch.trim()) return users.slice(0, 50);
    const q = userSearch.toLowerCase();
    return users.filter(u => 
      u.email.toLowerCase().includes(q) ||
      `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [users, userSearch]);

  const addMutation = useMutation({
    mutationFn: async (data) => {
      await api.post(`/auth/admin/users/${data.userId}/workspaces/`, {
        workspace_id: workspaceId,
        role: data.role
      });
    },
    onSuccess: () => {
      toast.success('Member added successfully');
      queryClient.invalidateQueries(['admin-workspace-members', workspaceId]);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to add member');
    }
  });

  const handleAdd = () => {
    if (!selectedUserId) return;
    addMutation.mutate({ userId: selectedUserId, role: selectedRole });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Workspace Member</DialogTitle>
          <DialogDescription>
            Search for a user to add to this workspace.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                disabled={addMutation.isPending}
              />
            </div>
            
            <div className="border rounded-md mt-2 h-[200px]">
              <ScrollArea className="h-full p-2">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No users found matching "{userSearch}"
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredUsers.map(user => (
                      <div 
                        key={user.id}
                        className={`p-2 rounded cursor-pointer border ${
                          selectedUserId === user.id 
                            ? 'bg-primary/10 border-primary' 
                            : 'hover:bg-muted border-transparent'
                        }`}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <div className="font-medium text-sm">
                          {(user.first_name || user.last_name) 
                            ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                            : 'Unknown Name'}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].map((role) => (
              <Button
                key={role}
                variant={selectedRole === role ? "default" : "outline"}
                className="h-10 text-xs px-2"
                onClick={() => setSelectedRole(role)}
                disabled={addMutation.isPending}
              >
                {role}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={addMutation.isPending || !selectedUserId}
          >
            {addMutation.isPending ? 'Adding...' : 'Add Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
