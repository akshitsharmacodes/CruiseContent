import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Key, Loader2, ServerCrash, Briefcase } from 'lucide-react';
import { cn } from './Layout';

const API_URL = 'http://localhost:8000/api/workspaces/';

export default function Workspaces() {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', open_ai_key: '' });

    const { data: workspaces = [], isLoading, isError } = useQuery({
        queryKey: ['workspaces'],
        queryFn: async () => {
            const res = await fetch(API_URL);
            if (!res.ok) throw new Error('Failed to fetch workspaces');
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async (newWorkspace) => {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newWorkspace)
            });
            if (!res.ok) throw new Error('Failed to create');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            setIsCreateOpen(false);
            setFormData({ name: '', open_ai_key: '' });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (updateData) => {
            const res = await fetch(`${API_URL}${updateData.id}/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: updateData.name, open_ai_key: updateData.open_ai_key })
            });
            if (!res.ok) throw new Error('Failed to update');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            setEditingId(null);
            setFormData({ name: '', open_ai_key: '' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`${API_URL}${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            updateMutation.mutate({ id: editingId, ...formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (workspace) => {
        setFormData({ name: workspace.name, open_ai_key: workspace.open_ai_key || '' });
        setEditingId(workspace.id);
        setIsCreateOpen(true);
    };

    if (isLoading) {
        return (
            <div className="p-12 flex items-center justify-center text-gray-500 min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-red-500 min-h-screen">
                <ServerCrash className="w-12 h-12 mb-4 opacity-50" />
                <p>Failed to load workspaces. Is the backend running?</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-light text-gray-900 tracking-tight">Workspaces</h1>
                    <p className="text-gray-500 mt-1">Manage your teams and API keys</p>
                </div>
                <button 
                    onClick={() => {
                        setIsCreateOpen(true);
                        setEditingId(null);
                        setFormData({ name: '', open_ai_key: '' });
                    }}
                    className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-full font-medium transition-colors shadow-sm cursor-pointer"
                >
                    <Plus className="w-5 h-5" />
                    New Workspace
                </button>
            </div>

            {isCreateOpen && (
                <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h2 className="text-lg font-medium mb-4">{editingId ? 'Edit Workspace' : 'Create New Workspace'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Name</label>
                            <input 
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="e.g. Marketing Team"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key (Optional)</label>
                            <div className="relative">
                                <Key className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="password"
                                    value={formData.open_ai_key}
                                    onChange={e => setFormData({...formData, open_ai_key: e.target.value})}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                    placeholder="sk-..."
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Workspace'}
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsCreateOpen(false)}
                                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workspaces.map((workspace) => (
                    <div key={workspace.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 font-bold text-xl border border-blue-100/50">
                                {workspace.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handleEdit(workspace)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => {
                                        if (confirm('Are you sure you want to delete this workspace?')) {
                                            deleteMutation.mutate(workspace.id);
                                        }
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">{workspace.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                            <span className={cn("w-2 h-2 rounded-full", workspace.open_ai_key ? "bg-green-500" : "bg-gray-300")}></span>
                            {workspace.open_ai_key ? 'OpenAI Connected' : 'No AI Key'}
                        </div>
                        <div className="text-xs text-gray-400 pt-4 border-t border-gray-50">
                            Created {new Date(workspace.created_at).toLocaleDateString()}
                        </div>
                    </div>
                ))}
                
                {workspaces.length === 0 && !isCreateOpen && (
                    <div className="col-span-full py-16 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                        <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No Workspaces Found</h3>
                        <p className="text-gray-500">Create your first workspace to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
