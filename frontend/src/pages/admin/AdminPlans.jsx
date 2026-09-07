import { useState, useMemo } from 'react';
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
  ServerCrash,
  Plus,
  Edit,
  LayoutList,
  Check,
  X,
  MoreHorizontal,
  Eye,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export default function AdminPlans() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Centered Dialog state for Plan Details & Entitlements
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  // Dialog states for plan creation/editing
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null); // null = creating new
  const [planForm, setPlanForm] = useState({
    name: '', code: '', description: '', price: '', currency: 'INR', billing_interval: 'MONTHLY', is_active: true
  });

  // Dialog state for Delete confirmation
  const [planToDelete, setPlanToDelete] = useState(null);

  // Dialog states for entitlement creation/editing
  const [isEntitlementDialogOpen, setIsEntitlementDialogOpen] = useState(false);
  const [editingEntitlement, setEditingEntitlement] = useState(null);
  const [entitlementForm, setEntitlementForm] = useState({
    feature_code: '', enabled: true, limit_value: '', limit_period: 'NONE'
  });

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const { data: plansData, isLoading: isLoadingPlans, isError: isErrorPlans, error: errorPlans, refetch: refetchPlans } = useQuery({
    queryKey: ['adminPlans'],
    queryFn: async () => {
      try {
        const response = await api.get('/payments/admin/billing/plans/');
        return response.data.plans;
      } catch (err) {
        if (err.response?.status === 403) navigate('/403');
        throw err;
      }
    },
  });

  const { data: entitlementsData, isLoading: isLoadingEntitlements } = useQuery({
    queryKey: ['adminPlanEntitlements', selectedPlan?.id],
    queryFn: async () => {
      if (!selectedPlan) return [];
      const response = await api.get(`/payments/admin/billing/plans/${selectedPlan.id}/entitlements/`);
      return response.data.entitlements;
    },
    enabled: !!selectedPlan,
  });

  // -------------------------------------------------------------
  // Mutations - Plans
  // -------------------------------------------------------------
  const createPlanMutation = useMutation({
    mutationFn: async (payload) => api.post('/payments/admin/billing/plans/', payload),
    onSuccess: () => {
      toast.success('Plan created successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPlans'] });
      setIsPlanDialogOpen(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to create plans.');
      } else {
        toast.error('Failed to create plan: ' + (err.response?.data?.error || err.message));
      }
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, payload }) => api.patch(`/payments/admin/billing/plans/${id}/`, payload),
    onSuccess: () => {
      toast.success('Plan updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPlans'] });
      setIsPlanDialogOpen(false);
      // Update selectedPlan if we are viewing it
      if (selectedPlan && selectedPlan.id === editingPlan?.id) {
        setSelectedPlan({ ...selectedPlan, ...planForm });
      }
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to update plans.');
      } else {
        toast.error('Failed to update plan: ' + (err.response?.data?.error || err.message));
      }
    }
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id) => api.delete(`/payments/admin/billing/plans/${id}/`),
    onSuccess: () => {
      toast.success('Plan deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPlans'] });
      if (selectedPlan?.id === planToDelete?.id) {
        setSelectedPlan(null);
      }
      setPlanToDelete(null);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to delete plans.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete plan');
      }
    }
  });

  // -------------------------------------------------------------
  // Mutations - Entitlements
  // -------------------------------------------------------------
  const createEntitlementMutation = useMutation({
    mutationFn: async (payload) => api.post(`/payments/admin/billing/plans/${selectedPlan.id}/entitlements/`, payload),
    onSuccess: () => {
      toast.success('Entitlement created successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPlanEntitlements', selectedPlan.id] });
      setIsEntitlementDialogOpen(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to modify plan entitlements.');
      } else {
        toast.error('Failed to create entitlement: ' + (err.response?.data?.error || err.message));
      }
    }
  });

  const updateEntitlementMutation = useMutation({
    mutationFn: async ({ id, payload }) => api.patch(`/payments/admin/billing/entitlements/${id}/`, payload),
    onSuccess: () => {
      toast.success('Entitlement updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPlanEntitlements', selectedPlan.id] });
      setIsEntitlementDialogOpen(false);
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to modify plan entitlements.');
      } else {
        toast.error('Failed to update entitlement: ' + (err.response?.data?.error || err.message));
      }
    }
  });

  const deleteEntitlementMutation = useMutation({
    mutationFn: async (id) => api.delete(`/payments/admin/billing/entitlements/${id}/`),
    onSuccess: () => {
      toast.success('Entitlement deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPlanEntitlements', selectedPlan.id] });
    },
    onError: (err) => {
      if (err.response?.status === 403) {
        toast.error('Access denied. You do not have permission to modify plan entitlements.');
      } else {
        toast.error('Failed to delete entitlement: ' + (err.response?.data?.error || err.message));
      }
    }
  });

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  const filteredPlans = useMemo(() => {
    if (!plansData) return [];
    if (!searchQuery.trim()) return plansData;
    
    const query = searchQuery.toLowerCase();
    return plansData.filter(plan => 
      plan.name.toLowerCase().includes(query) || 
      plan.code.toLowerCase().includes(query)
    );
  }, [plansData, searchQuery]);

  const openPlanDialog = (plan = null) => {
    setEditingPlan(plan);
    if (plan) {
      setPlanForm({
        name: plan.name,
        code: plan.code,
        description: plan.description || '',
        price: plan.price.toString(),
        currency: plan.currency || 'INR',
        billing_interval: plan.billing_interval || 'MONTHLY',
        is_active: plan.is_active
      });
    } else {
      setPlanForm({
        name: '', code: '', description: '', price: '', currency: 'INR', billing_interval: 'MONTHLY', is_active: true
      });
    }
    setIsPlanDialogOpen(true);
  };

  const submitPlan = () => {
    if (!planForm.name || !planForm.code || !planForm.price) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const payload = {
      name: planForm.name,
      description: planForm.description,
      price: planForm.price,
      is_active: planForm.is_active
    };
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, payload });
    } else {
      payload.code = planForm.code;
      payload.currency = planForm.currency;
      payload.billing_interval = planForm.billing_interval;
      createPlanMutation.mutate(payload);
    }
  };

  const openEntitlementDialog = (ent = null) => {
    setEditingEntitlement(ent);
    if (ent) {
      setEntitlementForm({
        feature_code: ent.feature_code,
        enabled: ent.enabled,
        limit_value: ent.limit_value !== null ? ent.limit_value.toString() : '',
        limit_period: ent.limit_period || 'NONE'
      });
    } else {
      setEntitlementForm({
        feature_code: '', enabled: true, limit_value: '', limit_period: 'NONE'
      });
    }
    setIsEntitlementDialogOpen(true);
  };

  const submitEntitlement = () => {
    if (!editingEntitlement && !entitlementForm.feature_code) {
      toast.error("Feature code is required.");
      return;
    }
    
    const payload = {
      enabled: entitlementForm.enabled,
      limit_period: entitlementForm.limit_period
    };
    
    if (entitlementForm.limit_value === '') {
      payload.limit_value = null;
    } else {
      payload.limit_value = parseInt(entitlementForm.limit_value, 10);
      if (isNaN(payload.limit_value)) {
        toast.error("Limit value must be a number or empty.");
        return;
      }
    }

    if (editingEntitlement) {
      updateEntitlementMutation.mutate({ id: editingEntitlement.id, payload });
    } else {
      payload.feature_code = entitlementForm.feature_code;
      createEntitlementMutation.mutate(payload);
    }
  };

  // -------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------
  if (isErrorPlans) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center space-y-4 rounded-md border border-dashed text-center">
        <ServerCrash className="h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">Failed to load plans</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {errorPlans.response?.data?.error || errorPlans.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchPlans()}>
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
          <h2 className="text-3xl font-bold tracking-tight">Billing Plans</h2>
          <p className="text-muted-foreground">
            Manage platform subscription tiers, pricing, and feature entitlements.
          </p>
        </div>
        <Button onClick={() => openPlanDialog(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Plans Directory</CardTitle>
            <div className="flex items-center gap-2 w-full max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name or code..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => refetchPlans()} title="Refresh">
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPlans ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !plansData || plansData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No Plans Found</p>
              <p className="text-sm text-muted-foreground">Click 'Create Plan' to get started.</p>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No matching plans</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium cursor-pointer" onClick={() => setSelectedPlan(plan)}>
                        {plan.name}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => setSelectedPlan(plan)}>
                        <Badge variant="outline" className="font-mono">{plan.code}</Badge>
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => setSelectedPlan(plan)}>
                        {plan.price} {plan.currency}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => setSelectedPlan(plan)}>
                        <span className="capitalize">{plan.billing_interval?.toLowerCase()}</span>
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => setSelectedPlan(plan)}>
                        {plan.is_active ? (
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
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
                            <DropdownMenuItem onClick={() => setSelectedPlan(plan)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPlanDialog(plan)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit Plan
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPlanToDelete(plan)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Plan
                            </DropdownMenuItem>
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

      {/* Plan Details & Entitlements Centered Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plan Details</DialogTitle>
            <DialogDescription>
              View configuration and manage feature entitlements for {selectedPlan?.name}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 bg-muted/30">
                <div>
                  <h5 className="text-xs text-muted-foreground mb-1">Plan Name</h5>
                  <p className="text-sm font-medium">{selectedPlan.name}</p>
                </div>
                <div>
                  <h5 className="text-xs text-muted-foreground mb-1">Code</h5>
                  <p className="text-sm font-mono">{selectedPlan.code}</p>
                </div>
                <div>
                  <h5 className="text-xs text-muted-foreground mb-1">Price</h5>
                  <p className="text-sm">{selectedPlan.price} {selectedPlan.currency}</p>
                </div>
                <div>
                  <h5 className="text-xs text-muted-foreground mb-1">Status</h5>
                  {selectedPlan.is_active ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
                {selectedPlan.description && (
                  <div className="col-span-2">
                    <h5 className="text-xs text-muted-foreground mb-1">Description</h5>
                    <p className="text-xs text-muted-foreground">{selectedPlan.description}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between pt-2 border-t">
                  <h4 className="text-sm font-semibold flex items-center">
                    <LayoutList className="w-4 h-4 mr-2" /> Feature Entitlements
                  </h4>
                  <Button size="sm" variant="outline" onClick={() => openEntitlementDialog(null)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Feature
                  </Button>
                </div>

                {isLoadingEntitlements ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !entitlementsData || entitlementsData.length === 0 ? (
                  <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                    No entitlements defined for this plan.
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Feature</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Limit</TableHead>
                          <TableHead className="text-right w-[90px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entitlementsData.map(ent => (
                          <TableRow key={ent.id}>
                            <TableCell className="font-mono text-xs">{ent.feature_code}</TableCell>
                            <TableCell>
                              {ent.enabled ? (
                                <span className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Enabled
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-xs text-destructive font-medium">
                                  <X className="h-3.5 w-3.5 mr-1" /> Disabled
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {ent.limit_value !== null ? ent.limit_value : 'Unlimited'} 
                              {ent.limit_period !== 'NONE' && <span className="ml-1 opacity-70">/ {ent.limit_period.toLowerCase()}</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEntitlementDialog(ent)} className="h-7 w-7 p-0">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteEntitlementMutation.mutate(ent.id)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPlan(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Create/Edit Centered Dialog */}
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Modify the plan details below.' : 'Define a new platform subscription tier.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="planName" className="text-right">Name <span className="text-destructive">*</span></Label>
              <Input id="planName" className="col-span-3" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="planCode" className="text-right">Code <span className="text-destructive">*</span></Label>
              <Input id="planCode" className="col-span-3 font-mono" value={planForm.code} onChange={e => setPlanForm({...planForm, code: e.target.value.toUpperCase()})} disabled={!!editingPlan} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="planDesc" className="text-right">Description</Label>
              <Input id="planDesc" className="col-span-3" value={planForm.description} onChange={e => setPlanForm({...planForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="planPrice" className="text-right">Price <span className="text-destructive">*</span></Label>
              <div className="col-span-3 flex gap-2">
                <Input id="planPrice" type="number" step="0.01" value={planForm.price} onChange={e => setPlanForm({...planForm, price: e.target.value})} />
                <Select value={planForm.currency} onValueChange={v => setPlanForm({...planForm, currency: v})} disabled={!!editingPlan}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingPlan && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Interval <span className="text-destructive">*</span></Label>
                <Select value={planForm.billing_interval} onValueChange={v => setPlanForm({...planForm, billing_interval: v})}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="planActive" className="text-right">Status</Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Checkbox id="planActive" checked={planForm.is_active} onCheckedChange={checked => setPlanForm({...planForm, is_active: checked})} />
                <label htmlFor="planActive" className="text-sm font-medium leading-none cursor-pointer">
                  Plan is active and available
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitPlan} disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
              {(createPlanMutation.isPending || updatePlanMutation.isPending) && <RotateCw className="mr-2 h-4 w-4 animate-spin" />}
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation Dialog */}
      <Dialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Delete Plan</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to delete the plan <strong>{planToDelete?.name}</strong> ({planToDelete?.code})?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground">
            Plans referenced by existing subscriptions cannot be deleted and should instead be set to inactive.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanToDelete(null)} disabled={deletePlanMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletePlanMutation.mutate(planToDelete?.id)}
              disabled={deletePlanMutation.isPending}
            >
              {deletePlanMutation.isPending ? 'Deleting...' : 'Delete Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entitlement Create/Edit Centered Dialog */}
      <Dialog open={isEntitlementDialogOpen} onOpenChange={setIsEntitlementDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editingEntitlement ? 'Edit Entitlement' : 'Add Entitlement'}</DialogTitle>
            <DialogDescription>
              Configure feature limits for the {selectedPlan?.name} plan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entFeature" className="text-right text-xs">Feature <span className="text-destructive">*</span></Label>
              <Input id="entFeature" className="col-span-3 font-mono text-sm" value={entitlementForm.feature_code} onChange={e => setEntitlementForm({...entitlementForm, feature_code: e.target.value.toUpperCase()})} disabled={!!editingEntitlement} placeholder="e.g. MAX_WORKSPACES" />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entEnabled" className="text-right text-xs">Enabled</Label>
              <div className="col-span-3 flex items-center space-x-2">
                <Checkbox id="entEnabled" checked={entitlementForm.enabled} onCheckedChange={checked => setEntitlementForm({...entitlementForm, enabled: checked})} />
                <label htmlFor="entEnabled" className="text-sm text-muted-foreground cursor-pointer">
                  Feature is accessible
                </label>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entLimit" className="text-right text-xs">Limit Value</Label>
              <div className="col-span-3 flex gap-2">
                <Input id="entLimit" type="number" placeholder="Unlimited if empty" value={entitlementForm.limit_value} onChange={e => setEntitlementForm({...entitlementForm, limit_value: e.target.value})} />
                <Select value={entitlementForm.limit_period} onValueChange={v => setEntitlementForm({...entitlementForm, limit_period: v})}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Reset</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="BILLING_PERIOD">Billing Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEntitlementDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitEntitlement} disabled={createEntitlementMutation.isPending || updateEntitlementMutation.isPending}>
              {(createEntitlementMutation.isPending || updateEntitlementMutation.isPending) && <RotateCw className="mr-2 h-4 w-4 animate-spin" />}
              Save Feature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
