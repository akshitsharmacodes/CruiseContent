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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, ShieldAlert, CheckCircle2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Centered dialog for Suspending a Workspace.
 * Transition: ACTIVE -> SUSPENDED
 */
export function AdminSuspendWorkspaceDialog({ workspace, open, onOpenChange }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        status: 'SUSPENDED',
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      const res = await api.patch(`/auth/admin/workspaces/${workspace.id}/status/`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Workspace "${workspace.name}" suspended successfully`);
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaces'] });
      queryClient.invalidateQueries({ queryKey: ['adminWorkspace', workspace.id] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to perform this action.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to suspend workspace');
      }
    },
  });

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>Suspend Workspace</DialogTitle>
          </div>
          <DialogDescription>
            Suspend access for this workspace and restrict its active operations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Workspace:</span>
              <span className="font-semibold">{workspace.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Current Status:</span>
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                {workspace.status || (workspace.is_active ? 'ACTIVE' : 'INACTIVE')}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Target Status:</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                SUSPENDED
              </Badge>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded border border-amber-200 dark:border-amber-900/50 leading-relaxed">
            <span className="font-semibold text-amber-800 dark:text-amber-400">Notice:</span> Suspending this workspace will block standard workspace user access and automated operations. The workspace can later be reactivated by an authorized administrator.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="suspend-reason" className="text-sm font-medium">
              Suspension Reason <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Textarea
              id="suspend-reason"
              placeholder="Provide a reason for auditing records..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={mutation.isPending}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Suspending...' : 'Suspend Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Centered dialog for Activating a Workspace.
 * Transition: SUSPENDED -> ACTIVE
 */
export function AdminActivateWorkspaceDialog({ workspace, open, onOpenChange }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/auth/admin/workspaces/${workspace.id}/status/`, {
        status: 'ACTIVE',
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Workspace "${workspace.name}" activated successfully`);
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaces'] });
      queryClient.invalidateQueries({ queryKey: ['adminWorkspace', workspace.id] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to perform this action.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to activate workspace');
      }
    },
  });

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
            <DialogTitle>Activate Workspace</DialogTitle>
          </div>
          <DialogDescription>
            Restore normal operations and user access for this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Workspace:</span>
              <span className="font-semibold">{workspace.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Current Status:</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                {workspace.status || 'SUSPENDED'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Target Status:</span>
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
                ACTIVE
              </Badge>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded border border-emerald-200 dark:border-emerald-900/50 leading-relaxed">
            <span className="font-semibold text-emerald-800 dark:text-emerald-400">Notice:</span> Activating this workspace will re-enable normal workspace operations, content generation, and team access.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Activating...' : 'Activate Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Centered dialog for Archiving a Workspace.
 * Transition: ACTIVE/SUSPENDED -> ARCHIVED (Terminal)
 */
export function AdminArchiveWorkspaceDialog({ workspace, open, onOpenChange }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setConfirmName('');
      setError(null);
    }
  }, [open]);

  const isConfirmed = workspace && confirmName.trim() === workspace.name?.trim();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/auth/admin/workspaces/${workspace.id}/status/`, {
        status: 'ARCHIVED',
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Workspace "${workspace.name}" archived successfully`);
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaces'] });
      queryClient.invalidateQueries({ queryKey: ['adminWorkspace', workspace.id] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to perform this action.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to archive workspace');
      }
    },
  });

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle>Archive Workspace</DialogTitle>
          </div>
          <DialogDescription>
            Permanently archive this workspace. This action is terminal and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Workspace:</span>
              <span className="font-semibold">{workspace.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Current Status:</span>
              <span className="font-medium text-xs">
                {workspace.status || (workspace.is_active ? 'ACTIVE' : 'INACTIVE')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Target Status:</span>
              <Badge variant="destructive" className="bg-destructive/90 text-destructive-foreground">
                ARCHIVED
              </Badge>
            </div>
          </div>

          <div className="text-xs text-destructive bg-destructive/10 p-3 rounded border border-destructive/20 leading-relaxed space-y-1">
            <p className="font-semibold">Critical Terminal State Warning:</p>
            <p>
              • <strong>ARCHIVED</strong> is a terminal lifecycle state in the system.
            </p>
            <p>
              • It acts as a safe soft-delete: data is preserved for audit and billing, but normal operations cannot be restored.
            </p>
            <p>
              • The workspace is <strong>not physically deleted</strong> from the database.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="archive-confirmation" className="text-xs font-medium">
              To confirm, type the exact workspace name <span className="font-bold text-foreground select-all">"{workspace.name}"</span> below:
            </Label>
            <Input
              id="archive-confirmation"
              placeholder={workspace.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              disabled={mutation.isPending}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!isConfirmed || mutation.isPending}
          >
            {mutation.isPending ? 'Archiving...' : 'Archive Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Centered confirmation dialog for permanently Deleting a Workspace (Master Admin only).
 */
export function AdminDeleteWorkspaceDialog({ workspace, open, onOpenChange }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    if (open) {
      setError(null);
      setConfirmName('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/auth/admin/workspaces/${workspace.id}/`);
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Workspace "${workspace.name}" deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['adminWorkspaces'] });
      queryClient.invalidateQueries({ queryKey: ['adminWorkspace', workspace.id] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        setError('Access denied. Only Master Admin can delete workspaces.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to delete workspace');
      }
    },
  });

  if (!workspace) return null;

  const isConfirmed = confirmName.trim() === workspace.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-500">
            <Trash2 className="h-5 w-5" />
            <DialogTitle>Delete Workspace</DialogTitle>
          </div>
          <DialogDescription>
            This action is permanent and cannot be undone. All subscriptions, platform credentials, and workspace data will be permanently removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Workspace:</span>
              <span className="font-semibold text-foreground">{workspace.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Owner:</span>
              <span className="text-foreground">{workspace.owner?.email || 'None'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Total Members:</span>
              <span className="text-foreground font-medium">{workspace.member_count || 0}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-workspace-confirmation" className="text-xs font-medium">
              To confirm deletion, type <span className="font-bold text-foreground select-all">"{workspace.name}"</span> below:
            </Label>
            <Input
              id="delete-workspace-confirmation"
              placeholder={workspace.name}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              disabled={mutation.isPending}
              autoComplete="off"
              className="border-rose-300 dark:border-rose-800 focus-visible:ring-rose-500"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!isConfirmed || mutation.isPending}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {mutation.isPending ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
