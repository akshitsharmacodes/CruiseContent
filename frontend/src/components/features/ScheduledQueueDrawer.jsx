import React, { useState, useEffect } from 'react';
import useApi from '../../hooks/useApi';
import { toast } from 'sonner';
import { Loader2, CalendarClock, Edit2, X, Check, LayoutGrid, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { DateTimePicker } from '@/components/ui/date-time-picker';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ScheduledQueueDrawer({ trigger }) {
  const api = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('chronological'); // chronological, platform, date
  
  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editTime, setEditTime] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchScheduledPosts();
    }
  }, [isOpen]);

  const fetchScheduledPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get('platform/scheduled/');
      setPosts(res.data);
    } catch (error) {
      toast.error('Failed to load scheduled queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (post) => {
    setEditingId(post.id);
    setEditContent(post.content);
    
    if (post.scheduled_for) {
      const localDate = new Date(post.scheduled_for);
      const tzOffset = localDate.getTimezoneOffset() * 60000;
      const localIso = new Date(localDate.getTime() - tzOffset).toISOString().slice(0, 16);
      setEditTime(localIso);
    } else {
      setEditTime('');
    }
  };

  const handleSaveEdit = async (id) => {
    setSavingId(id);
    try {
      const scheduledIso = editTime ? new Date(editTime).toISOString() : null;
      
      const res = await api.put(`platform/scheduled/${id}/`, {
        content: editContent,
        scheduled_for: scheduledIso
      });
      
      setPosts(posts.map(p => p.id === id ? { ...p, content: editContent, scheduled_for: scheduledIso } : p));
      toast.success('Post updated successfully!');
      setEditingId(null);
    } catch (error) {
      toast.error('Failed to update post.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelPost = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled post? It will be permanently deleted.")) {
      return;
    }
    
    setCancelingId(id);
    try {
      await api.delete(`platform/scheduled/${id}/`);
      setPosts(posts.filter(p => p.id !== id));
      toast.success('Post canceled successfully.');
    } catch (error) {
      toast.error('Failed to cancel post.');
    } finally {
      setCancelingId(null);
    }
  };

  let groupedPosts = {};
  
  if (viewMode === 'platform') {
    posts.forEach(p => {
      const plat = p.platform || 'UNKNOWN';
      if (!groupedPosts[plat]) groupedPosts[plat] = [];
      groupedPosts[plat].push(p);
    });
  } else if (viewMode === 'date') {
    posts.forEach(p => {
      const dateKey = p.scheduled_for ? format(new Date(p.scheduled_for), 'MMM dd, yyyy') : 'No Date';
      if (!groupedPosts[dateKey]) groupedPosts[dateKey] = [];
      groupedPosts[dateKey].push(p);
    });
  } else {
    groupedPosts = { 'Upcoming': [...posts].sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for)) };
  }

  const renderPostCard = (post) => {
    const isEditing = editingId === post.id;
    
    return (
      <div key={post.id} className="border border-border rounded-xl p-4 mb-4 bg-card shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <div>
            <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
              {post.platform.replace('_PAGE', '')}
            </Badge>
            {post.account_name && <p className="text-xs text-muted-foreground font-medium mb-1">{post.account_name}</p>}
          </div>
          {post.image_url && (
            <img src={`http://localhost:8000${post.image_url}`} alt="preview" className="w-12 h-12 rounded object-cover border border-border" />
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Content</label>
              <Textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)}
                className="mt-1 min-h-[100px] text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Scheduled Time</label>
              <DateTimePicker 
                date={editTime}
                setDate={setEditTime}
                disabled={savingId === post.id}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={savingId === post.id}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleSaveEdit(post.id)} disabled={savingId === post.id}>
                {savingId === post.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm line-clamp-3 mb-4">{post.content}</p>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center text-sm text-muted-foreground">
                <CalendarClock className="w-4 h-4 mr-1.5" />
                {post.scheduled_for ? format(new Date(post.scheduled_for), 'MMM dd, h:mm a') : 'Unscheduled'}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(post)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleCancelPost(post.id)} disabled={cancelingId === post.id}>
                  {cancelingId === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 border-l border-border bg-background">
        <div className="p-6 pb-4 border-b border-border flex-shrink-0 bg-muted/30">
          <SheetHeader>
            <SheetTitle className="flex items-center text-xl">
              <CalendarClock className="w-5 h-5 mr-2 text-primary" />
              Scheduled Queue
            </SheetTitle>
            <SheetDescription>
              Manage your upcoming automated posts.
            </SheetDescription>
          </SheetHeader>

          {posts.length > 0 && (
            <div className="mt-6 flex items-center gap-2 bg-background border border-border p-1 rounded-lg">
              <Button 
                variant={viewMode === 'chronological' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="flex-1 text-xs h-8"
                onClick={() => setViewMode('chronological')}
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" /> Time
              </Button>
              <Button 
                variant={viewMode === 'date' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="flex-1 text-xs h-8"
                onClick={() => setViewMode('date')}
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" /> Date
              </Button>
              <Button 
                variant={viewMode === 'platform' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="flex-1 text-xs h-8"
                onClick={() => setViewMode('platform')}
              >
                <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Platform
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p className="text-sm font-medium">Loading queue...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CalendarClock className="w-8 h-8 opacity-50" />
              </div>
              <p className="font-semibold text-foreground">Your queue is empty</p>
              <p className="text-sm max-w-[250px] mt-2">Generate some content and schedule it to see it appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedPosts).map(group => (
                <div key={group}>
                  {viewMode !== 'chronological' && (
                    <h4 className="text-sm font-bold text-foreground mb-3 capitalize sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                      {group.replace('_PAGE', '')}
                    </h4>
                  )}
                  <div className="space-y-4">
                    {groupedPosts[group].map(post => renderPostCard(post))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
