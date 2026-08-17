import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DateTimePicker } from '@/components/ui/date-time-picker';

export default function ReviewEditor({ platform, content, imageUrl, onUpdate, onPublish, onRegenerate }) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(platform);
      toast.success(`${platform} content regenerated!`);
    } catch (e) {
      // toast is already handled in the hook
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    setIsPublishing(true);
    try {
      let scheduledForIso = null;
      if (scheduledFor) {
          scheduledForIso = new Date(scheduledFor).toISOString();
      }
      await onPublish(platform, scheduledForIso);
    } catch (e) {
      // Error handled by hook
    } finally {
      setIsPublishing(false);
    }
  };

  if (!content) return null;

  return (
    <div className="bg-card border border-border p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
          {platform} Content
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Ready for review</span>
        </h3>
      </div>
      
      <div className="flex flex-col gap-4 mb-4">
        {imageUrl && (
          <div className="rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center relative group">
            <img 
              src={`http://localhost:8000${imageUrl}`} 
              alt="Generated preview" 
              className="w-full h-auto object-cover max-h-[300px]"
            />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full">
              AI Generated
            </span>
          </div>
        </div>
      )}
      
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => onUpdate(platform, e.target.value)}
          className={`min-h-[200px] text-base resize-y w-full ${(isRegenerating || isPublishing) ? 'opacity-50 pointer-events-none' : ''}`}
          disabled={isRegenerating || isPublishing}
        />
        {(isRegenerating || isPublishing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
      </div>
    </div>
    
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mt-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto flex-wrap">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap shrink-0">
          Schedule (Optional):
        </label>
        <div className="flex-1 min-w-[200px]">
          <DateTimePicker 
            date={scheduledFor} 
            setDate={setScheduledFor} 
            disabled={isRegenerating || isPublishing} 
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 w-full lg:w-auto flex-wrap sm:flex-nowrap">
        <Button 
          variant="outline" 
          className="rounded-full flex-1 sm:flex-none" 
          onClick={handleRegenerate}
          disabled={isRegenerating || isPublishing}
        >
          {isRegenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Regenerate
        </Button>
        <Button 
          onClick={handlePublish} 
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-1 sm:flex-none"
          disabled={isRegenerating || isPublishing}
        >
          {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {isPublishing ? 'Publishing...' : (scheduledFor ? 'Schedule Post' : 'Approve & Post')}
        </Button>
      </div>
    </div>
    </div>
  );
}
