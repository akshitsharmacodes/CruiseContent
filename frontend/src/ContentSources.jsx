import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Rss, Loader2, ServerCrash, Webhook, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { cn } from './Layout';

const SOURCES_API_URL = 'http://localhost:8000/api/ingestion/sources/';
const WORKSPACES_API_URL = 'http://localhost:8000/api/workspaces/';

export default function ContentSources() {
    const queryClient = useQueryClient();
    const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ url: '', source_type: 'RSS', is_active: true });

    // Fetch workspaces for the dropdown
    const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
        queryKey: ['workspaces'],
        queryFn: async () => {
            const res = await fetch(WORKSPACES_API_URL);
            if (!res.ok) throw new Error('Failed to fetch workspaces');
            const data = await res.json();
            if (data.length > 0 && !activeWorkspaceId) {
                setActiveWorkspaceId(data[0].id);
            }
            return data;
        }
    });

    // Fetch content sources for the active workspace
    const { data: sources = [], isLoading: sourcesLoading, isError } = useQuery({
        queryKey: ['contentSources', activeWorkspaceId],
        queryFn: async () => {
            const res = await fetch(`${SOURCES_API_URL}?workspace=${activeWorkspaceId}`);
            if (!res.ok) throw new Error('Failed to fetch sources');
            return res.json();
        },
        enabled: !!activeWorkspaceId
    });

    const createMutation = useMutation({
        mutationFn: async (newSource) => {
            const res = await fetch(SOURCES_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newSource, workspace: activeWorkspaceId })
            });
            if (!res.ok) throw new Error('Failed to create');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contentSources', activeWorkspaceId] });
            setIsCreateOpen(false);
            setFormData({ url: '', source_type: 'RSS', is_active: true });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (updateData) => {
            const res = await fetch(`${SOURCES_API_URL}${updateData.id}/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...updateData, workspace: activeWorkspaceId })
            });
            if (!res.ok) throw new Error('Failed to update');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contentSources', activeWorkspaceId] });
            setEditingId(null);
            setFormData({ url: '', source_type: 'RSS', is_active: true });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`${SOURCES_API_URL}${id}/`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contentSources', activeWorkspaceId] });
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

    const handleEdit = (source) => {
        setFormData({ url: source.url || '', source_type: source.source_type, is_active: source.is_active });
        setEditingId(source.id);
        setIsCreateOpen(true);
    };

    if (workspacesLoading) {
        return (
            <div className="p-12 flex items-center justify-center text-gray-500 min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (workspaces.length === 0) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 min-h-screen">
                <Rss className="w-12 h-12 mb-4 opacity-50" />
                <p>Please create a Workspace first before adding content sources.</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-light text-gray-900 tracking-tight">Content Sources</h1>
                    <p className="text-gray-500 mt-1">Manage RSS feeds and webhooks for content ingestion</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-xs font-medium text-gray-500 mb-1">Active Workspace</label>
                        <select 
                            value={activeWorkspaceId} 
                            onChange={(e) => setActiveWorkspaceId(e.target.value)}
                            className="bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-64 px-4 py-2.5 outline-none shadow-sm cursor-pointer"
                        >
                            {workspaces.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={() => {
                            setIsCreateOpen(true);
                            setEditingId(null);
                            setFormData({ url: '', source_type: 'RSS', is_active: true });
                        }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm cursor-pointer mt-5"
                    >
                        <Plus className="w-5 h-5" />
                        Add Source
                    </button>
                </div>
            </div>

            {isCreateOpen && (
                <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                    <h2 className="text-lg font-medium mb-4">{editingId ? 'Edit Content Source' : 'Add Content Source'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                                <select 
                                    value={formData.source_type}
                                    onChange={e => setFormData({...formData, source_type: e.target.value})}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                                >
                                    <option value="RSS">RSS Feed</option>
                                    <option value="WEBHOOK">Webhook</option>
                                    <option value="MANUAL">Manual Input</option>
                                </select>
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.is_active}
                                        onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Source is Active</span>
                                </label>
                            </div>
                        </div>
                        {formData.source_type !== 'MANUAL' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {formData.source_type === 'RSS' ? 'RSS Feed URL' : 'Webhook URL'}
                                </label>
                                <div className="relative">
                                    <LinkIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="url"
                                        required
                                        value={formData.url}
                                        onChange={e => setFormData({...formData, url: e.target.value})}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save Source'}
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

            {sourcesLoading ? (
                 <div className="py-12 flex justify-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : isError ? (
                <div className="py-12 text-center text-red-500">Failed to load sources for this workspace.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sources.map((source) => (
                        <div key={source.id} className={cn(
                            "bg-white rounded-2xl p-6 border shadow-sm hover:shadow-md transition-all group relative",
                            source.is_active ? "border-gray-100" : "border-gray-200 bg-gray-50 opacity-80"
                        )}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl border",
                                    source.source_type === 'RSS' ? "bg-orange-50 text-orange-500 border-orange-100/50" : 
                                    source.source_type === 'WEBHOOK' ? "bg-purple-50 text-purple-500 border-purple-100/50" :
                                    "bg-blue-50 text-blue-500 border-blue-100/50"
                                )}>
                                    {source.source_type === 'RSS' ? <Rss className="w-6 h-6" /> : 
                                     source.source_type === 'WEBHOOK' ? <Webhook className="w-6 h-6" /> :
                                     <Edit2 className="w-6 h-6" />}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleEdit(source)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this source?')) {
                                                deleteMutation.mutate(source.id);
                                            }
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {source.source_type === 'RSS' ? 'RSS Feed' : source.source_type === 'WEBHOOK' ? 'Webhook Listener' : 'Manual Entry'}
                            </h3>
                            
                            {source.url ? (
                                <a href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-4 truncate">
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{source.url}</span>
                                </a>
                            ) : (
                                <div className="text-sm text-gray-400 mb-4 h-5">No URL provided</div>
                            )}

                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                                <span className={cn("w-2 h-2 rounded-full", source.is_active ? "bg-green-500" : "bg-gray-400")}></span>
                                {source.is_active ? 'Active (Collecting)' : 'Paused'}
                            </div>
                            <div className="text-xs text-gray-400 pt-4 border-t border-gray-100">
                                Added {new Date(source.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                    
                    {sources.length === 0 && !isCreateOpen && (
                        <div className="col-span-full py-16 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                            <Rss className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No Sources Yet</h3>
                            <p className="text-gray-500">Connect an RSS feed or webhook to this workspace.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
