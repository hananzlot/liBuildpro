import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Send, Reply, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ClientCommentsProps {
  estimateId?: string;
  projectId?: string;
  portalTokenId?: string;
  commenterName?: string;
  commenterEmail?: string;
  isStaff?: boolean;
}

interface Comment {
  id: string;
  comment_text: string;
  commenter_name: string;
  commenter_email: string | null;
  is_internal: boolean;
  created_at: string;
  parent_comment_id: string | null;
  created_by: string | null;
  profiles?: { full_name: string | null } | null;
  replies?: Comment[];
}

export function ClientComments({
  estimateId,
  projectId,
  portalTokenId,
  commenterName: initialName = '',
  commenterEmail: initialEmail = '',
  isStaff = false,
}: ClientCommentsProps) {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [isInternal, setIsInternal] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['client-comments', estimateId, projectId],
    queryFn: async () => {
      let query = supabase
        .from('client_comments')
        .select(`
          *,
          profiles:created_by (full_name)
        `)
        .order('created_at', { ascending: true });

      if (estimateId) {
        query = query.eq('estimate_id', estimateId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      if (!isStaff) {
        query = query.eq('is_internal', false);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Organize into threads
      const topLevel = (data || []).filter((c: Comment) => !c.parent_comment_id);
      const replies = (data || []).filter((c: Comment) => c.parent_comment_id);

      return topLevel.map((comment: Comment) => ({
        ...comment,
        replies: replies.filter((r: Comment) => r.parent_comment_id === comment.id),
      }));
    },
  });

  const addComment = useMutation({
    mutationFn: async ({
      text,
      parentId,
    }: {
      text: string;
      parentId?: string | null;
    }) => {
      if (!isStaff && (!name.trim() || !email.trim())) {
        throw new Error('Name and email are required');
      }

      const { data, error } = await supabase.from('client_comments').insert({
        estimate_id: estimateId || null,
        project_id: projectId || null,
        portal_token_id: portalTokenId || null,
        commenter_name: isStaff ? 'Staff' : name,
        commenter_email: isStaff ? null : email,
        comment_text: text,
        parent_comment_id: parentId || null,
        is_internal: isStaff && isInternal,
        created_by: isStaff ? (await supabase.auth.getUser()).data.user?.id : null,
        company_id: companyId,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-comments', estimateId, projectId] });
      setNewComment('');
      setReplyText('');
      setReplyTo(null);
      toast.success('Comment added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent, parentId?: string | null) => {
    e.preventDefault();
    const text = parentId ? replyText : newComment;
    if (!text.trim()) return;
    addComment.mutate({ text, parentId });
  };

  const getInitials = (nameStr: string) => {
    return nameStr
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div
      key={comment.id}
      className={`flex gap-3 ${isReply ? 'ml-10 mt-3' : ''}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={comment.is_internal ? 'bg-yellow-100' : 'bg-primary/10'}>
          {getInitials(comment.profiles?.full_name || comment.commenter_name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {comment.profiles?.full_name || comment.commenter_name}
          </span>
          {comment.is_internal && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
              Internal
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap">{comment.comment_text}</p>
        {!isReply && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
        )}

        {/* Reply form */}
        {replyTo === comment.id && (
          <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-2 flex gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 min-h-[60px] text-sm"
            />
            <Button type="submit" size="sm" disabled={addComment.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Replies */}
        {comment.replies?.map((reply) => renderComment(reply, true))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Comments & Questions</h3>
        <span className="text-sm text-muted-foreground">({comments.length})</span>
      </div>

      {/* Existing comments */}
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet. Be the first to ask a question!</p>
        ) : (
          comments.map((comment: Comment) => renderComment(comment))
        )}
      </div>

      {/* New comment form */}
      <form onSubmit={(e) => handleSubmit(e)} className="space-y-3 pt-4 border-t">
        {!isStaff && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name *"
              required
            />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email *"
              required
            />
          </div>
        )}
        
        {isStaff && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-gray-300"
            />
            Internal note (only visible to staff)
          </label>
        )}

        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ask a question or leave a comment..."
            className="flex-1 min-h-[80px]"
          />
          <Button
            type="submit"
            disabled={addComment.isPending || !newComment.trim()}
            className="self-end"
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
