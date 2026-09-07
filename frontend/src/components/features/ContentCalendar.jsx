import React, { useState, useMemo } from 'react';
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO
} from 'date-fns';
import { getMediaUrl } from '../../lib/api';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Eye,
  CalendarDays,
  ListFilter,
  Layers,
  Sparkles,
  Share2,
  CalendarCheck,
  Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Helper to convert stored UTC ISO to browser-local input format (YYYY-MM-DDTHH:mm)
export function formatUtcToLocalInput(utcIsoString) {
  if (!utcIsoString) return '';
  const d = new Date(utcIsoString);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

// Helper to convert browser-local input value (YYYY-MM-DDTHH:mm) into canonical UTC ISO
export function localInputToUtcIso(localDatetimeString) {
  if (!localDatetimeString) return null;
  const d = new Date(localDatetimeString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

const PLATFORM_COLORS = {
  TWITTER: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 hover:bg-sky-500/20',
  FACEBOOK_PAGE: 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-600/20 hover:bg-blue-600/20',
  INSTAGRAM: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 hover:bg-pink-500/20',
  LINKEDIN: 'bg-blue-700/10 text-blue-700 dark:text-blue-400 border-blue-700/20 hover:bg-blue-700/20',
  WHATSAPP: 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20 hover:bg-emerald-600/20',
};

export default function ContentCalendar({
  posts = [],
  isLoading = false,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  onScheduleNew,
  onUpdatePost,
  onDeletePost
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day' | 'list'
  const [platformFilter, setPlatformFilter] = useState('ALL');

  // Edit / Reschedule Modal State
  const [selectedPost, setSelectedPost] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editScheduledFor, setEditScheduledFor] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // View Details Modal State
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Filter posts by platform
  const filteredPosts = useMemo(() => {
    if (!posts || !Array.isArray(posts)) return [];
    if (platformFilter === 'ALL') return posts;
    return posts.filter(p => p.platform === platformFilter);
  }, [posts, platformFilter]);

  // Map posts into day buckets using browser-local date matching
  const postsByDate = useMemo(() => {
    const map = new Map();
    filteredPosts.forEach(post => {
      if (!post.scheduled_for) return;
      const date = new Date(post.scheduled_for);
      if (isNaN(date.getTime())) return;
      const key = format(date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(post);
    });
    return map;
  }, [filteredPosts]);

  // Navigation handlers
  const handlePrevious = () => {
    if (viewMode === 'month') setCurrentDate(prev => subMonths(prev, 1));
    else if (viewMode === 'week') setCurrentDate(prev => subWeeks(prev, 1));
    else if (viewMode === 'day') setCurrentDate(prev => subDays(prev, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(prev => addMonths(prev, 1));
    else if (viewMode === 'week') setCurrentDate(prev => addWeeks(prev, 1));
    else if (viewMode === 'day') setCurrentDate(prev => addDays(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header Title
  const navigationTitle = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    if (viewMode === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    return 'All Scheduled Broadcasts';
  }, [currentDate, viewMode]);

  // Open Edit Modal
  const handleOpenEdit = (post, e) => {
    if (e) e.stopPropagation();
    setSelectedPost(post);
    setEditContent(post.content || '');
    setEditScheduledFor(formatUtcToLocalInput(post.scheduled_for));
    setIsEditOpen(true);
  };

  // Open View Modal
  const handleOpenView = (post, e) => {
    if (e) e.stopPropagation();
    setSelectedPost(post);
    setIsViewOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!selectedPost || !onUpdatePost) return;
    setIsSaving(true);
    try {
      const utcIso = localInputToUtcIso(editScheduledFor);
      await onUpdatePost(selectedPost.id, {
        content: editContent,
        scheduled_for: utcIso
      });
      setIsEditOpen(false);
      setSelectedPost(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete / Cancel Post
  const handleDelete = (postId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to cancel this scheduled post?')) return;
    if (onDeletePost) onDeletePost(postId);
  };

  // Quick schedule for clicked date
  const handleCellClick = (day) => {
    if (!canCreate || !onScheduleNew) return;
    // Set clicked day at 10:00 AM local
    const targetDate = new Date(day);
    targetDate.setHours(10, 0, 0, 0);
    const localStr = formatUtcToLocalInput(targetDate.toISOString());
    onScheduleNew(localStr);
  };

  // Calendar Day Generators
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  return (
    <Card className="shadow-sm border-border/80">
      <CardHeader className="p-4 sm:p-6 pb-4 border-b">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title & Navigation */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">
                {navigationTitle}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {filteredPosts.length} broadcast{filteredPosts.length === 1 ? '' : 's'} scheduled in active workspace
              </CardDescription>
            </div>
          </div>

          {/* Controls: Prev/Today/Next + View Tabs + Platform Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Nav Arrows */}
            {viewMode !== 'list' && (
              <div className="flex items-center rounded-lg border bg-background p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrevious}
                  title="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs font-medium"
                  onClick={handleToday}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNext}
                  title="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Platform Filter */}
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-8 text-xs w-36 bg-background">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Platforms</SelectItem>
                <SelectItem value="TWITTER">Twitter (X)</SelectItem>
                <SelectItem value="FACEBOOK_PAGE">Facebook</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Buttons */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setViewMode('month')}
              >
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs font-medium"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
            </div>

            {/* Quick Schedule Button */}
            {canCreate && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => onScheduleNew && onScheduleNew('')}
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule Post
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* 1. MONTH VIEW */}
        {viewMode === 'month' && (
          <div className="w-full select-none">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-semibold text-muted-foreground py-2.5">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
              <div>Sun</div>
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-7 divide-x divide-y border-b">
              {monthDays.map((day) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);
                const dayPosts = postsByDate.get(dayKey) || [];

                return (
                  <div
                    key={dayKey}
                    onClick={() => handleCellClick(day)}
                    className={cn(
                      "min-h-[110px] p-2 flex flex-col justify-between transition-colors group relative cursor-pointer",
                      !isCurrentMonth && "bg-muted/15 text-muted-foreground/50",
                      isCurrentDay && "bg-primary/5",
                      "hover:bg-muted/20"
                    )}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-xs font-medium inline-flex items-center justify-center rounded-full transition-all",
                          isCurrentDay
                            ? "h-6 w-6 bg-primary text-primary-foreground font-bold shadow-sm"
                            : "h-5 w-5 text-muted-foreground group-hover:text-foreground",
                          !isCurrentMonth && "opacity-40"
                        )}
                      >
                        {format(day, 'd')}
                      </span>

                      {canCreate && (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Plus className="h-3 w-3" />
                        </span>
                      )}
                    </div>

                    {/* Posts inside cell */}
                    <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[80px] scrollbar-none">
                      {dayPosts.slice(0, 3).map((post) => {
                        const localTime = post.scheduled_for ? format(new Date(post.scheduled_for), 'h:mm a') : '';
                        const colorClass = PLATFORM_COLORS[post.platform] || 'bg-secondary text-secondary-foreground';
                        return (
                          <div
                            key={post.id}
                            onClick={(e) => handleOpenView(post, e)}
                            className={cn(
                              "text-[11px] p-1 rounded-md border truncate cursor-pointer transition-all flex items-center gap-1 shadow-xs",
                              colorClass
                            )}
                            title={`${post.platform} at ${localTime}: ${post.content}`}
                          >
                            <span className="font-semibold text-[10px] shrink-0">{localTime}</span>
                            <span className="truncate">{post.content}</span>
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentDate(day);
                            setViewMode('day');
                          }}
                          className="text-[10px] font-semibold text-primary/80 hover:text-primary hover:underline pt-0.5 text-center cursor-pointer"
                        >
                          +{dayPosts.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. WEEK VIEW */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x border-b">
            {weekDays.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const isCurrentDay = isToday(day);
              const dayPosts = postsByDate.get(dayKey) || [];

              return (
                <div key={dayKey} className={cn("min-h-[350px] p-3 flex flex-col", isCurrentDay && "bg-primary/5")}>
                  {/* Column Header */}
                  <div className="border-b pb-2 mb-3 text-center">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {format(day, 'EEE')}
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold mt-0.5 inline-flex items-center justify-center rounded-full",
                        isCurrentDay ? "h-7 w-7 bg-primary text-primary-foreground mx-auto" : "text-foreground"
                      )}
                    >
                      {format(day, 'd')}
                    </p>
                  </div>

                  {/* Day Posts */}
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {dayPosts.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 text-center py-8">
                        No broadcasts
                      </p>
                    ) : (
                      dayPosts.map((post) => {
                        const localTime = post.scheduled_for ? format(new Date(post.scheduled_for), 'h:mm a') : '';
                        const colorClass = PLATFORM_COLORS[post.platform] || 'bg-secondary text-secondary-foreground';
                        return (
                          <div
                            key={post.id}
                            className={cn("p-2.5 rounded-lg border text-xs shadow-xs space-y-1.5 transition-all", colorClass)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[11px] flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {localTime}
                              </span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                                {post.platform.replace('_PAGE', '')}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-[11px] font-normal">{post.content}</p>
                            <div className="flex items-center justify-end gap-1 pt-1 border-t border-current/10">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => handleOpenView(post, e)}
                                title="View Details"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              {canUpdate && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => handleOpenEdit(post, e)}
                                  title="Reschedule / Edit"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={(e) => handleDelete(post.id, e)}
                                  title="Cancel Post"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Quick add at bottom of week column */}
                  {canCreate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCellClick(day)}
                      className="w-full mt-2 h-7 text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 3. DAY VIEW */}
        {viewMode === 'day' && (
          <div className="p-4 sm:p-6 space-y-4">
            {(() => {
              const dayKey = format(currentDate, 'yyyy-MM-dd');
              const dayPosts = postsByDate.get(dayKey) || [];

              if (dayPosts.length === 0) {
                return (
                  <div className="text-center py-16 text-muted-foreground">
                    <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-semibold text-base">No broadcasts scheduled for {format(currentDate, 'MMMM d, yyyy')}</p>
                    <p className="text-xs mt-1">Pick another date or schedule a new post for this day.</p>
                    {canCreate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCellClick(currentDate)}
                        className="mt-4 gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        Schedule for this Day
                      </Button>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-3 max-w-2xl mx-auto">
                  {dayPosts.map((post) => {
                    const localTime = post.scheduled_for ? format(new Date(post.scheduled_for), 'h:mm a') : '';
                    const colorClass = PLATFORM_COLORS[post.platform] || 'bg-secondary text-secondary-foreground';

                    return (
                      <Card key={post.id} className="p-4 border shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{post.platform}</Badge>
                              <span className="text-xs font-semibold flex items-center gap-1 text-amber-600">
                                <Clock className="h-3.5 w-3.5" />
                                {localTime}
                              </span>
                              {post.account_name && (
                                <span className="text-xs text-muted-foreground">via {post.account_name}</span>
                              )}
                            </div>
                            <p className="text-sm pt-1 whitespace-pre-wrap">{post.content}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleOpenView(post, e)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                            {canUpdate && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleOpenEdit(post, e)}
                              >
                                <Edit2 className="h-3.5 w-3.5 mr-1" />
                                Reschedule
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={(e) => handleDelete(post.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* 4. LIST / QUEUE VIEW */}
        {viewMode === 'list' && (
          <div>
            {filteredPosts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-base">No upcoming broadcasts scheduled</p>
                <p className="text-xs mt-1">Schedule social drafts to automatically publish on specific dates.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post Content</TableHead>
                    <TableHead className="w-36">Platform</TableHead>
                    <TableHead className="w-48">Scheduled Broadcast</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.map((post) => {
                    const localFormatted = post.scheduled_for
                      ? format(new Date(post.scheduled_for), 'MMM d, yyyy · h:mm a')
                      : '-';

                    return (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium max-w-md truncate">
                          {post.content}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{post.platform}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-amber-600">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {localFormatted}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => handleOpenView(post, e)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => handleOpenEdit(post, e)}
                                title="Reschedule"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => handleDelete(post.id, e)}
                                title="Cancel Post"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>

      {/* RESCHEDULE / EDIT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Broadcast</DialogTitle>
            <DialogDescription>
              Adjust post content or pick a new broadcast date and time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Post Content</Label>
              <Textarea
                rows={4}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Broadcast content..."
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scheduled Broadcast Time</Label>
              <Input
                type="datetime-local"
                value={editScheduledFor}
                onChange={(e) => setEditScheduledFor(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Configured in your local browser timezone. Converted cleanly to UTC upon save.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || !editContent.trim()}
              className="gap-1.5"
            >
              {isSaving ? 'Saving...' : 'Save & Reschedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW POST DETAILS DIALOG */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              Scheduled Broadcast Details
            </DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs text-muted-foreground">Platform</span>
                <Badge variant="outline">{selectedPost.platform}</Badge>
              </div>

              {selectedPost.account_name && (
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs text-muted-foreground">Target Account</span>
                  <span className="font-medium text-xs">{selectedPost.account_name}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs text-muted-foreground">Scheduled Time</span>
                <span className="font-semibold text-xs text-amber-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {selectedPost.scheduled_for ? format(new Date(selectedPost.scheduled_for), 'EEEE, MMMM d, yyyy · h:mm a') : '-'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Broadcast Content</span>
                <div className="p-3 bg-muted/40 rounded-lg whitespace-pre-wrap text-xs">
                  {selectedPost.content}
                </div>
              </div>

              {selectedPost.image_url && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Attached Graphic</span>
                  <img
                    src={getMediaUrl(selectedPost.image_url)}
                    alt="Post visual"
                    className="w-full h-auto max-h-48 object-cover rounded-lg border"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {canUpdate && selectedPost && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsViewOpen(false);
                  handleOpenEdit(selectedPost);
                }}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                Reschedule
              </Button>
            )}
            <Button size="sm" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
