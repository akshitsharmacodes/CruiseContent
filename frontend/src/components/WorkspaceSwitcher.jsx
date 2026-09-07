import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from 'react-router-dom';

export default function WorkspaceSwitcher({ className }) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const { accessToken, currentWorkspaceId, adminLevel } = useAuth();
  const navigate = useNavigate();

  const fetchWorkspaces = React.useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/workspaces/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces", error);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchWorkspaces();

    const handleUpdate = () => {
      fetchWorkspaces();
    };

    window.addEventListener('workspace-updated', handleUpdate);
    return () => {
      window.removeEventListener('workspace-updated', handleUpdate);
    };
  }, [fetchWorkspaces]);

  const handleSwitchWorkspace = async (workspaceId) => {
    if (workspaceId === currentWorkspaceId) {
      setOpen(false);
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/workspaces/switch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ workspace_id: workspaceId })
      });
      
      if (res.ok) {
        window.dispatchEvent(new Event('workspace-updated'));
        window.location.reload(); 
      }
    } catch (error) {
      console.error("Failed to switch workspace", error);
    }
  };

  const selectedWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) fetchWorkspaces();
    }}>
      <PopoverTrigger render={
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a workspace"
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate text-left max-w-[160px]">
            {selectedWorkspace?.name || "Select Workspace..."}
          </span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      } />
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search workspace..." />
            <CommandEmpty>No workspace found.</CommandEmpty>
            <CommandGroup heading="Workspaces">
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  onSelect={() => handleSwitchWorkspace(workspace.id)}
                  className="text-sm"
                >
                  {workspace.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      currentWorkspaceId === workspace.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  if (adminLevel) {
                    navigate('/admin/workspaces?action=create', { state: { openCreate: true } });
                  } else {
                    navigate('/onboarding');
                  }
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Workspace
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
