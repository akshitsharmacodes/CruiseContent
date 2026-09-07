import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AdminRolePermissions({
  availableSoftware = [],
  selectedPermissions = [],
  onChange,
  readOnly = false
}) {
  // State for expanded software and feature modules
  const [expandedSoftware, setExpandedSoftware] = useState(() => {
    const init = {};
    availableSoftware.forEach(sw => {
      init[sw.code] = true;
    });
    return init;
  });

  const [expandedFeatures, setExpandedFeatures] = useState(() => {
    const init = {};
    availableSoftware.forEach(sw => {
      sw.features?.forEach(feat => {
        init[`${sw.code}.${feat.code}`] = true;
      });
    });
    return init;
  });

  const toggleSoftware = (swCode) => {
    setExpandedSoftware(prev => ({ ...prev, [swCode]: !prev[swCode] }));
  };

  const toggleFeature = (key) => {
    setExpandedFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to check if a specific action is selected
  const isActionSelected = (swCode, featCode, action) => {
    const perm = selectedPermissions.find(p => p.software === swCode && p.feature === featCode);
    return perm ? perm.actions.includes(action) : false;
  };

  // Helper to toggle a single action
  const handleToggleAction = (swCode, featCode, action) => {
    if (readOnly) return;

    let updated = [...selectedPermissions];
    const existingIndex = updated.findIndex(p => p.software === swCode && p.feature === featCode);

    if (existingIndex >= 0) {
      const currentActions = updated[existingIndex].actions;
      let newActions;
      if (currentActions.includes(action)) {
        newActions = currentActions.filter(a => a !== action);
      } else {
        newActions = [...currentActions, action];
      }

      if (newActions.length === 0) {
        updated.splice(existingIndex, 1);
      } else {
        updated[existingIndex] = {
          ...updated[existingIndex],
          actions: newActions
        };
      }
    } else {
      updated.push({
        software: swCode,
        feature: featCode,
        actions: [action]
      });
    }

    onChange(updated);
  };

  // Feature Bulk Selection
  const getFeatureSelectionState = (swCode, feat) => {
    const perm = selectedPermissions.find(p => p.software === swCode && p.feature === feat.code);
    if (!perm || perm.actions.length === 0) return 'NONE';
    if (perm.actions.length === feat.actions.length) return 'ALL';
    return 'SOME';
  };

  const handleToggleFeatureAll = (swCode, feat) => {
    if (readOnly) return;

    const state = getFeatureSelectionState(swCode, feat);
    let updated = [...selectedPermissions];
    const existingIndex = updated.findIndex(p => p.software === swCode && p.feature === feat.code);

    if (state === 'ALL') {
      // Deselect all
      if (existingIndex >= 0) {
        updated.splice(existingIndex, 1);
      }
    } else {
      // Select all
      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          actions: [...feat.actions]
        };
      } else {
        updated.push({
          software: swCode,
          feature: feat.code,
          actions: [...feat.actions]
        });
      }
    }

    onChange(updated);
  };

  // Software Bulk Selection
  const handleToggleSoftwareAll = (sw) => {
    if (readOnly) return;

    // Check if all actions in all features of this software are selected
    let totalActions = 0;
    let selectedCount = 0;

    sw.features.forEach(feat => {
      totalActions += feat.actions.length;
      const perm = selectedPermissions.find(p => p.software === sw.code && p.feature === feat.code);
      if (perm) selectedCount += perm.actions.length;
    });

    const isAll = selectedCount === totalActions && totalActions > 0;
    let updated = selectedPermissions.filter(p => p.software !== sw.code);

    if (!isAll) {
      // Select all for all features
      sw.features.forEach(feat => {
        updated.push({
          software: sw.code,
          feature: feat.code,
          actions: [...feat.actions]
        });
      });
    }

    onChange(updated);
  };

  if (!availableSoftware || availableSoftware.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No software is currently available for this workspace.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {availableSoftware.map((sw) => {
        const isSwExpanded = expandedSoftware[sw.code] !== false;

        // Calculate count of selected actions in this software
        let selectedInSw = 0;
        let totalInSw = 0;
        sw.features.forEach(f => {
          totalInSw += f.actions.length;
          const perm = selectedPermissions.find(p => p.software === sw.code && p.feature === f.code);
          if (perm) selectedInSw += perm.actions.length;
        });

        return (
          <div key={sw.code} className="rounded-lg border bg-card text-card-foreground shadow-xs overflow-hidden">
            {/* Software Header */}
            <div className="flex items-center justify-between p-3 bg-muted/40 hover:bg-muted/60 transition-colors">
              <div
                className="flex items-center gap-2 cursor-pointer select-none flex-1"
                onClick={() => toggleSoftware(sw.code)}
              >
                {isSwExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-semibold text-sm">{sw.name}</span>
                <Badge variant="outline" className="text-xs">
                  {selectedInSw}/{totalInSw} selected
                </Badge>
              </div>

              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleToggleSoftwareAll(sw)}
                >
                  {selectedInSw === totalInSw ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>

            {/* Features list */}
            {isSwExpanded && (
              <div className="p-3 space-y-3 divide-y divide-border/60">
                {sw.features.map((feat) => {
                  const featKey = `${sw.code}.${feat.code}`;
                  const isFeatExpanded = expandedFeatures[featKey] !== false;
                  const featState = getFeatureSelectionState(sw.code, feat);

                  return (
                    <div key={feat.code} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-2 cursor-pointer select-none"
                          onClick={() => toggleFeature(featKey)}
                        >
                          {isFeatExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <span className="text-xs font-medium text-foreground">{feat.name}</span>
                        </div>

                        {!readOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
                            onClick={() => handleToggleFeatureAll(sw.code, feat)}
                          >
                            {featState === 'ALL' ? 'Deselect' : 'Select All'}
                          </Button>
                        )}
                      </div>

                      {/* Actions Checkboxes */}
                      {isFeatExpanded && (
                        <div className="pl-6 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          {feat.actions.map((act) => {
                            const checked = isActionSelected(sw.code, feat.code, act);
                            return (
                              <label
                                key={act}
                                className={`flex items-center space-x-2 text-xs rounded-md border p-2 select-none transition-colors ${
                                  checked
                                    ? 'border-primary/40 bg-primary/5 text-foreground'
                                    : 'border-border/60 text-muted-foreground hover:bg-muted/30'
                                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={readOnly}
                                  onCheckedChange={() => handleToggleAction(sw.code, feat.code, act)}
                                />
                                <span className="font-mono font-medium text-[11px]">{act}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
