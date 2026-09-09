import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles, Layers, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboardingCheck } from '../hooks/useOnboardingCheck';
import { useGenerationTask } from '../hooks/useGenerationTask';
import PlatformSelector from '../components/features/PlatformSelector';
import ReviewEditor from '../components/features/ReviewEditor';
import ScheduledQueueDrawer from '../components/features/ScheduledQueueDrawer';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SOFTWARE_DEFINITIONS } from '@/lib/softwareDefinitions';

export default function Dashboard() {
  useOnboardingCheck();
  const navigate = useNavigate();
  const { can, userSoftwareModules, adminLevel, isLoadingPermissions, currentWorkspaceName } = useAuth();
  const canCreatePost = can('SOCIAL_MEDIA_MANAGER', 'POSTS', 'CREATE');
  const hasSocialMedia = adminLevel === 'MASTER' || userSoftwareModules.includes('SOCIAL_MEDIA_MANAGER');
  const hasAnySoftware = adminLevel === 'MASTER' || userSoftwareModules.length > 0;

  const [inputData, setInputData] = useState({ text: '', url: '', image: null });

  const [imagePrompt, setImagePrompt] = useState('');
  const [generateImage, setGenerateImage] = useState(true);
  const [platforms, setPlatforms] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (platforms.includes('instagram')) {
      setGenerateImage(true);
    }
  }, [platforms]);

  const { status, generatedContent, startGeneration, updateContent, publishContent, regeneratePlatform } = useGenerationTask();

  const handlePlatformToggle = (platform) => {
    setPlatforms(prev => 
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const combinedInput = [
    inputData.text ? `Thoughts: ${inputData.text}` : '',
    inputData.url ? `URL: ${inputData.url}` : '',
    inputData.image ? `Image Attached: ${inputData.image.name}` : ''
  ].filter(Boolean).join('\n');

  const handleGenerate = () => {
    if (!inputData.text && !inputData.url && !inputData.image) {
      toast.error('Please provide at least one source (text, url, or image).');
      return;
    }
    if (platforms.length === 0) {
      toast.error('Please select at least one target platform.');
      return;
    }
    
    startGeneration('combined', combinedInput, platforms, imagePrompt, generateImage);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {hasSocialMedia ? "Create Post" : (currentWorkspaceName ? `${currentWorkspaceName} Dashboard` : "Workspace Dashboard")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hasSocialMedia 
              ? "Draft and deploy content across your social channels."
              : "Welcome to your SofricAI workspace client portal."}
          </p>
        </div>
        {hasSocialMedia && (
          <div className="flex gap-3">
            <ScheduledQueueDrawer 
              trigger={<Button variant="secondary">Scheduled Queue</Button>} 
            />
            <Button variant="outline" onClick={() => navigate('/platforms')}>
              Manage Platforms
            </Button>
          </div>
        )}
      </div>

      {/* 1. Loading Skeleton */}
      {isLoadingPermissions && (
        <div className="space-y-4 animate-pulse">
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}

      {/* 2. Empty State: Zero Software Entitlements */}
      {!isLoadingPermissions && !hasAnySoftware && (
        <Card className="shadow-none border-border bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Welcome to Your Workspace</CardTitle>
                <CardDescription>
                  No software products are currently entitled or assigned to your role in this workspace.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your workspace is active, but does not have any software products enabled yet. Contact your workspace administrator to activate software subscriptions (such as Social Media Manager, WhatsApp Campaigns, AI Calling, or ChatBots) or to assign custom roles.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate('/pricing')}>
                View Available Plans
              </Button>
              {(adminLevel === 'MASTER' || adminLevel === 'ADMIN') && (
                <Button variant="secondary" onClick={() => navigate('/admin')}>
                  Open Admin Console
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Software Hub: Entitled Software other than Social Media Manager */}
      {!isLoadingPermissions && hasAnySoftware && !hasSocialMedia && (
        <Card className="shadow-none border-border bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Entitled Software Hub</CardTitle>
                <CardDescription>
                  You have access to the following software applications in this workspace:
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userSoftwareModules.map((modCode) => {
                const swInfo = SOFTWARE_DEFINITIONS.find(s => s.code === modCode);
                if (!swInfo) return null;
                const Icon = swInfo.icon;
                return (
                  <Button
                    key={modCode}
                    variant="outline"
                    className="justify-between h-14 px-4 text-left hover:bg-muted group"
                    onClick={() => navigate(swInfo.path)}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-sm">{swInfo.name}</div>
                        <div className="text-xs text-muted-foreground">{swInfo.badge}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Social Media Manager Generator */}
      {hasSocialMedia && (
        <>
          <Card className="shadow-none border-border">
            <CardHeader>
              <CardTitle className="text-lg">Source Material</CardTitle>
              <CardDescription>What should we base the post on?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 mb-8">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Text Thoughts</label>
                <Textarea 
                  placeholder="Jot down your raw thoughts..." 
                  className="min-h-[120px] bg-transparent focus-visible:ring-1 focus-visible:ring-ring"
                  value={inputData.text || ''}
                  onChange={(e) => setInputData(prev => ({ ...prev, text: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Blog Post URL</label>
                <Input 
                  type="url" 
                  placeholder="https://example.com/blog-post"
                  className="bg-transparent focus-visible:ring-1 focus-visible:ring-ring"
                  value={inputData.url || ''}
                  onChange={(e) => setInputData(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Image Upload</label>
                <Input 
                  type="file" 
                  className="bg-transparent focus-visible:ring-1 focus-visible:ring-ring cursor-pointer" 
                  onChange={(e) => setInputData(prev => ({ ...prev, image: e.target.files[0] }))}
                />
              </div>
            </div>

            <div className="space-y-6 mb-8 mt-6 border-t border-border pt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Custom Image Prompt (Optional)</label>
                <p className="text-xs text-muted-foreground">Describe exactly what you want the AI image generator to create.</p>
                <Textarea 
                  placeholder="e.g. A futuristic cyberpunk city at sunset, 4k resolution..." 
                  className="min-h-[80px] bg-transparent focus-visible:ring-1 focus-visible:ring-ring"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3 text-foreground">Target Platforms</h3>
              <PlatformSelector platforms={platforms} handlePlatformToggle={handlePlatformToggle} />
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t border-border pt-6 mt-2">
            <div className="flex flex-col">
              <div className="flex items-center space-x-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={generateImage}
                        disabled={platforms.includes('instagram')}
                        onClick={() => {
                          if (!platforms.includes('instagram')) {
                            setGenerateImage(!generateImage);
                          }
                        }}
                        className={`${
                          generateImage ? 'bg-primary' : 'bg-muted'
                        } ${platforms.includes('instagram') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                      >
                        <span
                          aria-hidden="true"
                          className={`${
                            generateImage ? 'translate-x-5' : 'translate-x-0'
                          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out`}
                        />
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {platforms.includes('instagram') 
                      ? 'Instagram requires an image. You cannot disable image generation.' 
                      : 'Toggle AI image generation on or off.'}
                  </TooltipContent>
                </Tooltip>
                <span className="text-sm font-medium text-foreground">
                  Generate Image
                </span>
              </div>
              {platforms.includes('instagram') && (
                <span className="text-xs text-muted-foreground mt-1">
                  Required and locked for Instagram
                </span>
              )}
            </div>
            
            {canCreatePost ? (
              <Button 
                onClick={handleGenerate} 
                disabled={status === 'Pending' || status === 'Processing'}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6"
              >
                {(status === 'Pending' || status === 'Processing') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Posts
              </Button>
            ) : (
              <Button 
                disabled
                variant="secondary"
                className="rounded-full px-6 opacity-60 cursor-not-allowed"
                title="Your assigned role does not permit creating posts"
              >
                Creation Restricted
              </Button>
            )}
          </CardFooter>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[1200px] w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2 border-b">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Content Generation
              </DialogTitle>
              <DialogDescription>
                Review and refine the content generated for your selected platforms.
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1 min-h-0 p-6">
              {(status === 'Pending' || status === 'Processing') && (
                <div className="space-y-8 animate-pulse">
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                    <p className="text-sm font-medium">Crafting your social media posts...</p>
                  </div>
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-10 w-32 ml-auto rounded-full" />
                  </div>
                </div>
              )}

              {status === 'Completed' && Object.keys(generatedContent?.texts || generatedContent).length > 0 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(generatedContent?.texts || generatedContent).map(([platform, content]) => {
                      if (platform === 'image_url') return null; // Fallback to avoid rendering image_url as a platform
                      return (
                        <ReviewEditor
                          key={platform}
                          platform={platform}
                          content={content}
                          imageUrl={generatedContent?.image_url}
                          onUpdate={updateContent}
                          onPublish={publishContent}
                          onRegenerate={(plat) => regeneratePlatform(plat, 'combined', combinedInput)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </>
    )}
  </div>
);
}
