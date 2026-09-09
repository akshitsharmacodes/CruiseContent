import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import useApi from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import ContentCalendar, { formatUtcToLocalInput, localInputToUtcIso } from '@/components/features/ContentCalendar';
import { getMediaUrl } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Share2,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Sparkles,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Layers,
  BarChart3,
  CalendarClock,
  Wand2
} from 'lucide-react';


const AVAILABLE_PLATFORMS = [
  { id: 'TWITTER', label: 'Twitter (X)', charLimit: 280 },
  { id: 'FACEBOOK_PAGE', label: 'Facebook Page', charLimit: 63206 },
  { id: 'INSTAGRAM', label: 'Instagram', charLimit: 2200 },
  { id: 'LINKEDIN', label: 'LinkedIn', charLimit: 3000 },
  { id: 'WHATSAPP', label: 'WhatsApp', charLimit: 4096 }
];

export default function SocialMediaManager() {
  const { can, userCustomRole, currentWorkspaceId } = useAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview');

  // Posts Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');

  // Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // Multi-Platform Create Form State
  const [selectedPlatforms, setSelectedPlatforms] = useState(['TWITTER', 'FACEBOOK_PAGE']);
  const [commonContent, setCommonContent] = useState('');
  const [platformContents, setPlatformContents] = useState({});
  const [activePlatformTab, setActivePlatformTab] = useState('TWITTER');
  const [createScheduledFor, setCreateScheduledFor] = useState('');

  // AI Generator state inside modal
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Engaging');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Edit Single Post Form State
  const [editFormData, setEditFormData] = useState({
    content: '',
    platform: 'TWITTER',
    scheduled_for: '',
    status: 'PENDING'
  });

  // Permissions
  const canViewPosts = can('SOCIAL_MEDIA_MANAGER', 'POSTS', 'VIEW');
  const canCreatePosts = can('SOCIAL_MEDIA_MANAGER', 'POSTS', 'CREATE');
  const canUpdatePosts = can('SOCIAL_MEDIA_MANAGER', 'POSTS', 'UPDATE');
  const canDeletePosts = can('SOCIAL_MEDIA_MANAGER', 'POSTS', 'DELETE');
  const canPublishPosts = can('SOCIAL_MEDIA_MANAGER', 'POSTS', 'PUBLISH');

  const canViewSchedules = can('SOCIAL_MEDIA_MANAGER', 'SCHEDULING', 'VIEW');
  const canCreateSchedules = can('SOCIAL_MEDIA_MANAGER', 'SCHEDULING', 'CREATE');
  const canUpdateSchedules = can('SOCIAL_MEDIA_MANAGER', 'SCHEDULING', 'UPDATE');
  const canDeleteSchedules = can('SOCIAL_MEDIA_MANAGER', 'SCHEDULING', 'DELETE');

  const canViewAnalytics = can('SOCIAL_MEDIA_MANAGER', 'ANALYTICS', 'VIEW');

  // React to workspace changes
  useEffect(() => {
    const handleWorkspaceChange = () => {
      queryClient.invalidateQueries({ queryKey: ['social-manager-scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-analytics'] });
    };
    window.addEventListener('workspace-updated', handleWorkspaceChange);
    return () => window.removeEventListener('workspace-updated', handleWorkspaceChange);
  }, [queryClient]);

  // 1. Fetch Analytics Metrics
  const { data: analyticsData, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['social-manager-analytics', currentWorkspaceId],
    queryFn: async () => {
      const res = await api.get('platform/analytics/');
      return res.data;
    },
    enabled: canViewAnalytics && !!currentWorkspaceId
  });

  // 2. Fetch Posts List
  const { data: postsData, isLoading: isLoadingPosts, refetch: refetchPosts } = useQuery({
    queryKey: ['social-manager-posts', currentWorkspaceId, statusFilter, platformFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (platformFilter !== 'ALL') params.append('platform', platformFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`platform/posts/?${params.toString()}`);
      return res.data;
    },
    enabled: canViewPosts && !!currentWorkspaceId
  });

  // 3. Fetch Scheduled Posts
  const { data: scheduledData, isLoading: isLoadingScheduled, refetch: refetchScheduled } = useQuery({
    queryKey: ['social-manager-scheduled', currentWorkspaceId],
    queryFn: async () => {
      const res = await api.get('platform/scheduled/');
      return res.data;
    },
    enabled: canViewSchedules && !!currentWorkspaceId
  });

  // Mutations
  const createPostMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('platform/posts/', payload);
      return res.data;
    },
    onSuccess: (data) => {
      const count = data?.created_count || (data?.posts ? data.posts.length : 1);
      toast.success(`Successfully created ${count} ${count > 1 ? 'posts' : 'post'}`);
      setIsCreateOpen(false);
      setCommonContent('');
      setPlatformContents({});
      setAiPrompt('');
      setCreateScheduledFor('');
      setSelectedPlatforms(['TWITTER', 'FACEBOOK_PAGE']);
      queryClient.invalidateQueries({ queryKey: ['social-manager-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-scheduled'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create post');
    }
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.patch(`platform/posts/${id}/`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Post updated successfully');
      setIsEditOpen(false);
      setSelectedPost(null);
      queryClient.invalidateQueries({ queryKey: ['social-manager-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-analytics'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update post');
    }
  });

  const reschedulePostMutation = useMutation({
    mutationFn: async ({ id, content, scheduled_for }) => {
      const res = await api.put(`platform/scheduled/${id}/`, { content, scheduled_for });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Broadcast rescheduled successfully');
      queryClient.invalidateQueries({ queryKey: ['social-manager-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-analytics'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to reschedule broadcast');
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`platform/posts/${id}/`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Post deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['social-manager-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-scheduled'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to delete post');
    }
  });

  const publishPostMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`platform/posts/${id}/publish/`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Post publishing initiated');
      queryClient.invalidateQueries({ queryKey: ['social-manager-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-manager-analytics'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to publish post');
    }
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Published</Badge>;
      case 'SCHEDULED':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Scheduled</Badge>;
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const handleEditClick = (post) => {
    setSelectedPost(post);
    setEditFormData({
      content: post.content,
      platform: post.platform,
      scheduled_for: formatUtcToLocalInput(post.scheduled_for),
      status: post.status
    });
    setIsEditOpen(true);
  };

  const handleTogglePlatform = (platId) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platId)) {
        if (prev.length === 1) {
          toast.warning('Please keep at least one platform selected.');
          return prev;
        }
        const next = prev.filter(id => id !== platId);
        if (activePlatformTab === platId) {
          setActivePlatformTab(next[0]);
        }
        return next;
      } else {
        return [...prev, platId];
      }
    });
  };

  const handleSelectAllPlatforms = () => {
    setSelectedPlatforms(AVAILABLE_PLATFORMS.map(p => p.id));
  };

  const handleResetPlatforms = () => {
    setSelectedPlatforms(['TWITTER']);
    setActivePlatformTab('TWITTER');
  };

  const handleGenerateMultiAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter an idea or prompt for the AI generator.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const res = await api.post('platform/generate-multi/', {
        prompt: aiPrompt,
        platforms: selectedPlatforms,
        tone: aiTone
      });
      const results = res.data.results || {};
      setPlatformContents(prev => ({ ...prev, ...results }));
      const firstSelected = selectedPlatforms[0];
      if (results[firstSelected]) {
        setCommonContent(results[firstSelected]);
        setActivePlatformTab(firstSelected);
      }
      toast.success(`Generated content for ${selectedPlatforms.length} platforms simultaneously!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate content.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCreatePostsSubmit = () => {
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one target platform.');
      return;
    }
    const hasContent = commonContent.trim() || Object.values(platformContents).some(c => c && c.trim());
    if (!hasContent) {
      toast.error('Please provide post content or generate with AI.');
      return;
    }

    const scheduledUtcIso = localInputToUtcIso(createScheduledFor);
    createPostMutation.mutate({
      platforms: selectedPlatforms,
      platform_content: platformContents,
      content: commonContent,
      scheduled_for: scheduledUtcIso,
      status: scheduledUtcIso ? 'SCHEDULED' : 'PENDING'
    });
  };

  const handleViewClick = (post) => {
    setSelectedPost(post);
    setIsViewOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Social Media Manager</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Enterprise multi-channel broadcasting, scheduling, and AI-driven content generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreatePosts && (
            <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Post
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/platforms')}>
            Connected Platforms
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canViewPosts && <TabsTrigger value="posts">All Posts</TabsTrigger>}
          {canCreatePosts && <TabsTrigger value="ai-generator">AI Studio</TabsTrigger>}
          {canViewSchedules && <TabsTrigger value="scheduling">Schedules</TabsTrigger>}
        </TabsList>

        {/* 1. OVERVIEW & ANALYTICS TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingAnalytics ? <Skeleton className="h-8 w-16" /> : analyticsData?.metrics?.total_posts || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Managed social entries</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Published Posts</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingAnalytics ? <Skeleton className="h-8 w-16" /> : analyticsData?.metrics?.published_posts || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Live across networks</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled Queue</CardTitle>
                <Calendar className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingAnalytics ? <Skeleton className="h-8 w-16" /> : analyticsData?.metrics?.scheduled_posts || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Upcoming broadcasts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Drafts / In Progress</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingAnalytics ? <Skeleton className="h-8 w-16" /> : analyticsData?.metrics?.draft_posts || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting approval or schedule</p>
              </CardContent>
            </Card>
          </div>

          {/* Connected Platforms & Breakdown */}
          {canViewAnalytics && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Posts by Platform
                  </CardTitle>
                  <CardDescription>Content distribution across social destinations.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAnalytics ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : !analyticsData?.platform_breakdown || Object.keys(analyticsData.platform_breakdown).length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                      No posts logged yet across platforms.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(analyticsData.platform_breakdown).map(([platform, count]) => (
                        <div key={platform} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-semibold">{platform}</Badge>
                          </div>
                          <span className="font-semibold">{count} posts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-primary" />
                    Connected Accounts
                  </CardTitle>
                  <CardDescription>Accounts authorized to publish social content.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAnalytics ? (
                    <Skeleton className="h-20 w-full" />
                  ) : !analyticsData?.connected_platforms || analyticsData.connected_platforms.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                      <p>No active platform credentials connected.</p>
                      <Button variant="link" onClick={() => navigate('/platforms')} className="mt-2 text-xs">
                        Connect Facebook or Twitter &rarr;
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analyticsData.connected_platforms.map((acc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{acc.name}</span>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-primary/20">{acc.platform}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* 2. ALL POSTS TAB */}
        {canViewPosts && (
          <TabsContent value="posts" className="space-y-4">
            {/* Filter Controls Bar */}
            <Card>
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Search post content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Draft</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="SUCCESS">Published</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Platforms</SelectItem>
                      <SelectItem value="TWITTER">Twitter</SelectItem>
                      <SelectItem value="FACEBOOK_PAGE">Facebook</SelectItem>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="icon" onClick={() => refetchPosts()} title="Refresh list">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Posts Table */}
            <Card>
              <CardContent className="p-0">
                {isLoadingPosts ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !postsData || postsData.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-semibold text-base">No posts found</p>
                    <p className="text-xs mt-1">Create your first social media post to get started.</p>
                    {canCreatePosts && (
                      <Button onClick={() => setIsCreateOpen(true)} variant="outline" className="mt-4 gap-1.5">
                        <Plus className="h-4 w-4" />
                        Create New Post
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Content</TableHead>
                        <TableHead className="w-32">Platform</TableHead>
                        <TableHead className="w-32">Status</TableHead>
                        <TableHead className="w-40">Scheduled / Date</TableHead>
                        <TableHead className="w-20 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {postsData.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell className="font-medium max-w-md truncate">
                            {post.content}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{post.platform}</Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(post.status)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {post.scheduled_for ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(post.scheduled_for).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewClick(post)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                {canUpdatePosts && (
                                  <DropdownMenuItem onClick={() => handleEditClick(post)}>
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Edit Post
                                  </DropdownMenuItem>
                                )}
                                {canPublishPosts && post.status !== 'SUCCESS' && (
                                  <DropdownMenuItem onClick={() => publishPostMutation.mutate(post.id)}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Publish Now
                                  </DropdownMenuItem>
                                )}
                                {canDeletePosts && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => deletePostMutation.mutate(post.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete Post
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 3. AI STUDIO / GENERATOR TAB */}
        {canCreatePosts && (
          <TabsContent value="ai-generator" className="space-y-4">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl">AI Studio & Content Generator</CardTitle>
                    </div>
                    <CardDescription>
                      Draft, tailor, and broadcast high-converting social media posts across all channels simultaneously.
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsCreateOpen(true)} className="gap-1.5 self-start sm:self-auto">
                    <Wand2 className="h-4 w-4" />
                    Open Studio Creator
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <span>Quick Prompt Creator</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter what you want to announce or create. The AI will craft tailored posts customized to the tone and character limits of each connected platform.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      placeholder="e.g. Announcing our new product feature with a limited-time 20% discount..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setIsCreateOpen(true);
                        }
                      }}
                      className="bg-background text-sm flex-1"
                    />
                    <Button
                      onClick={() => setIsCreateOpen(true)}
                      className="gap-2 shrink-0"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate Content
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-card/40 space-y-1.5">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-primary" />
                      Multi-Channel Tailoring
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Adapts tone, hashtags, and formatting specifically for Twitter, LinkedIn, Instagram, and Facebook.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-card/40 space-y-1.5">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      Tone Selection
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Switch between Engaging, Professional, Viral / Punchy, Promotional, and Casual tones seamlessly.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-card/40 space-y-1.5">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Instant Scheduling
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Schedule directly into your editorial calendar or publish instantly to all connected accounts.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 4. SCHEDULING TAB */}
        {canViewSchedules && (
          <TabsContent value="scheduling" className="space-y-4">
            <ContentCalendar
              posts={scheduledData || []}
              isLoading={isLoadingScheduled}
              canCreate={canCreateSchedules}
              canUpdate={canUpdateSchedules}
              canDelete={canDeleteSchedules}
              onScheduleNew={(prefilledDatetime) => {
                setCreateScheduledFor(prefilledDatetime || '');
                setIsCreateOpen(true);
              }}
              onUpdatePost={async (id, payload) => {
                await reschedulePostMutation.mutateAsync({ id, ...payload });
              }}
              onDeletePost={(id) => {
                deletePostMutation.mutate(id);
              }}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* CREATE POST DIALOG WITH SIMULTANEOUS MULTI-PLATFORM GENERATION */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Share2 className="h-5 w-5 text-primary" />
              Create & Broadcast Social Posts
            </DialogTitle>
            <DialogDescription>
              Select multiple target platforms and generate or compose tailored content simultaneously.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 1. Target Platforms Checkboxes (No dropdown) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Platforms ({selectedPlatforms.length} selected)
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-primary hover:text-primary/80"
                    onClick={handleSelectAllPlatforms}
                  >
                    Select All
                  </Button>
                  <span className="text-muted-foreground text-xs">•</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={handleResetPlatforms}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {AVAILABLE_PLATFORMS.map((plat) => {
                  const isChecked = selectedPlatforms.includes(plat.id);
                  return (
                    <label
                      key={plat.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                        isChecked
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 text-foreground font-medium'
                          : 'border-border bg-card/40 text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleTogglePlatform(plat.id)}
                      />
                      <span className="text-xs truncate">{plat.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. AI Multi-Platform Generator Toolbar */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>AI Multi-Platform Generator</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-background">
                  Simultaneous Multi-Channel
                </Badge>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="What is this post about? E.g., Announce our 20% discount and new AI features launch..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="bg-background text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerateMultiAI();
                    }
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Tone:</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger className="h-7 text-xs w-32 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Engaging">Engaging</SelectItem>
                      <SelectItem value="Professional">Professional</SelectItem>
                      <SelectItem value="Viral">Viral / Punchy</SelectItem>
                      <SelectItem value="Promotional">Promotional</SelectItem>
                      <SelectItem value="Casual">Casual / Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateMultiAI}
                  disabled={isGeneratingAI || !aiPrompt.trim() || selectedPlatforms.length === 0}
                  className="gap-1.5 h-8 text-xs font-medium"
                >
                  {isGeneratingAI ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Generating for {selectedPlatforms.length} Platforms...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      Generate for All Selected Platforms
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 3. Platform-Tailored Content Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Post Content</Label>
                {selectedPlatforms.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    Customize per platform below or use common text
                  </span>
                )}
              </div>

              {/* Platform Tabs Switcher */}
              {selectedPlatforms.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/50">
                  {selectedPlatforms.map(platId => {
                    const plat = AVAILABLE_PLATFORMS.find(p => p.id === platId) || { label: platId };
                    const hasSpecificContent = !!platformContents[platId];
                    const isActive = activePlatformTab === platId;
                    return (
                      <button
                        key={platId}
                        type="button"
                        onClick={() => setActivePlatformTab(platId)}
                        className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2 ${
                          isActive
                            ? 'border-primary text-primary bg-muted/40'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'
                        }`}
                      >
                        <span>{plat.label}</span>
                        {hasSpecificContent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Content textarea for active platform */}
              <div className="space-y-1">
                <Textarea
                  rows={5}
                  placeholder={`Write or refine content for ${AVAILABLE_PLATFORMS.find(p => p.id === activePlatformTab)?.label || 'selected platform'}...`}
                  value={
                    platformContents[activePlatformTab] !== undefined
                      ? platformContents[activePlatformTab]
                      : commonContent
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlatformContents(prev => ({ ...prev, [activePlatformTab]: val }));
                    if (!commonContent) setCommonContent(val);
                  }}
                  className="font-normal text-sm resize-y"
                />
                <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1">
                  <span>
                    Editing: <strong className="text-foreground">{AVAILABLE_PLATFORMS.find(p => p.id === activePlatformTab)?.label}</strong>
                  </span>
                  <span>
                    {((platformContents[activePlatformTab] !== undefined ? platformContents[activePlatformTab] : commonContent) || '').length} characters
                    {AVAILABLE_PLATFORMS.find(p => p.id === activePlatformTab)?.charLimit && (
                      ` / ${AVAILABLE_PLATFORMS.find(p => p.id === activePlatformTab).charLimit} limit`
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Scheduling Broadcast Options */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Schedule Broadcast (Optional)
              </Label>
              <Input
                type="datetime-local"
                value={createScheduledFor}
                onChange={(e) => setCreateScheduledFor(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty to save as pending draft, or choose a date/time to automatically broadcast.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePostsSubmit}
              disabled={createPostMutation.isPending || selectedPlatforms.length === 0 || (!commonContent.trim() && !Object.values(platformContents).some(c => c && c.trim()))}
              className="gap-1.5"
            >
              {createPostMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating Posts...
                </>
              ) : createScheduledFor ? (
                `Schedule ${selectedPlatforms.length} ${selectedPlatforms.length > 1 ? 'Posts' : 'Post'}`
              ) : (
                `Create ${selectedPlatforms.length} ${selectedPlatforms.length > 1 ? 'Posts' : 'Post'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT POST DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Social Post</DialogTitle>
            <DialogDescription>
              Modify content or scheduled broadcast timing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label>Post Content</Label>
              <Textarea
                rows={4}
                value={editFormData.content}
                onChange={(e) => setEditFormData(prev => ({ ...prev, content: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule Date / Time</Label>
              <Input
                type="datetime-local"
                value={editFormData.scheduled_for}
                onChange={(e) => setEditFormData(prev => ({ ...prev, scheduled_for: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(val) => setEditFormData(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Draft / Pending</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="SUCCESS">Published</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updatePostMutation.mutate({
                id: selectedPost.id,
                payload: {
                  ...editFormData,
                  scheduled_for: localInputToUtcIso(editFormData.scheduled_for)
                }
              })}
              disabled={updatePostMutation.isPending || !editFormData.content}
            >
              {updatePostMutation.isPending ? 'Updating...' : 'Update Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW DETAILS DIALOG */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4 py-3">
              <div>
                <Label className="text-xs text-muted-foreground">Platform & Status</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{selectedPost.platform}</Badge>
                  {getStatusBadge(selectedPost.status)}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Content</Label>
                <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap mt-1">
                  {selectedPost.content}
                </div>
              </div>

              {selectedPost.image_url && (
                <div>
                  <Label className="text-xs text-muted-foreground">Attached Graphic</Label>
                  <img
                    src={getMediaUrl(selectedPost.image_url)}
                    alt="Post visual"
                    className="w-full h-auto max-h-56 object-cover rounded-lg border mt-1"
                  />
                </div>
              )}

              {selectedPost.scheduled_for && (
                <div>
                  <Label className="text-xs text-muted-foreground">Scheduled For</Label>
                  <p className="text-sm font-medium mt-1">
                    {new Date(selectedPost.scheduled_for).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
