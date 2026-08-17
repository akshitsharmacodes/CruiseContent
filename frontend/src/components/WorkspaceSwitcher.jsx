import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  const { accessToken, currentWorkspaceId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/workspaces/', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          setWorkspaces(data);
        }
      } catch (error) {
        console.error("Failed to fetch workspaces", error);
      }
    };
    if (accessToken) {
      fetchWorkspaces();
    }
  }, [accessToken]);

  const handleSwitchWorkspace = async (workspaceId) => {
    if (workspaceId === currentWorkspaceId) {
      setOpen(false);
      return;
    }
    
    try {
      const res = await fetch('http://localhost:8000/api/workspaces/switch/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ workspace_id: workspaceId })
      });
      
      if (res.ok) {
        // Reload page to re-fetch all active data for the new workspace
        // This is a brutal but effective way to reset all state for now
        window.location.reload(); 
      }
    } catch (error) {
      console.error("Failed to switch workspace", error);
    }
  };

  const selectedWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                  navigate('/onboarding');
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
