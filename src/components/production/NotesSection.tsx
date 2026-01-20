import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Plus, Loader2, Trash2, MessageSquare, User, Reply, ChevronDown, ChevronUp, Send } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NoteComment {
  id: string;
  note_id: string;
  comment_text: string;
  created_by: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface ProjectNote {
  id: string;
  project_id: string;
  note_text: string;
  created_by: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  } | null;
  project_note_comments?: NoteComment[];
}

interface NotesSectionProps {
  projectId: string;
}

export function NotesSection({ projectId }: NotesSectionProps) {
  const queryClient = useQueryClient();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { companyId } = useCompanyContext();
  const [newNote, setNewNote] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [replyingToNoteId, setReplyingToNoteId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const canDeleteNotes = isAdmin || isSuperAdmin;

  // Fetch notes with user info and comments
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["project-notes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_notes")
        .select(`
          *,
          profiles:created_by (full_name, email),
          project_note_comments (
            id,
            note_id,
            comment_text,
            created_by,
            created_at,
            profiles:created_by (full_name, email)
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProjectNote[];
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const { error } = await supabase
        .from("project_notes")
        .insert({
          project_id: projectId,
          note_text: noteText,
          created_by: user?.id,
          company_id: companyId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note added");
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
    onError: (error) => toast.error(`Failed to add note: ${error.message}`),
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("project_notes")
        .delete()
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note deleted");
      setDeleteNoteId(null);
      queryClient.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
    onError: (error) => toast.error(`Failed to delete note: ${error.message}`),
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ noteId, commentText }: { noteId: string; commentText: string }) => {
      const { error } = await supabase
        .from("project_note_comments")
        .insert({
          note_id: noteId,
          comment_text: commentText,
          created_by: user?.id,
          company_id: companyId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment added");
      setNewComment("");
      setReplyingToNoteId(null);
      queryClient.invalidateQueries({ queryKey: ["project-notes", projectId] });
    },
    onError: (error) => toast.error(`Failed to add comment: ${error.message}`),
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate(newNote.trim());
  };

  const handleAddComment = (noteId: string) => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate({ noteId, commentText: newComment.trim() });
  };

  const toggleNoteExpanded = (noteId: string) => {
    setExpandedNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Notes
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">{notes.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Compact Add Note Form */}
        <div className="flex gap-2">
          <Input
            placeholder="Add a note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <Button
            onClick={handleAddNote}
            disabled={!newNote.trim() || addNoteMutation.isPending}
            size="sm"
            className="h-8 px-3"
          >
            {addNoteMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>

        {/* Notes List - Compact */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-3">
            No notes yet
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {notes.map((note) => {
              const comments = note.project_note_comments || [];
              const isExpanded = expandedNotes.has(note.id);
              
              return (
                <div
                  key={note.id}
                  className="border rounded-md p-2 space-y-1.5 bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs whitespace-pre-wrap flex-1 leading-relaxed">{note.note_text}</p>
                    {canDeleteNotes && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => setDeleteNoteId(note.id)}
                      >
                        <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="font-medium">{note.profiles?.full_name || note.profiles?.email?.split('@')[0] || "Unknown"}</span>
                    <span>•</span>
                    <span>{format(parseISO(note.created_at), "MMM d, h:mm a")}</span>
                  </div>

                  {/* Comments Section - Compact */}
                  <Collapsible open={isExpanded} onOpenChange={() => toggleNoteExpanded(note.id)}>
                    <div className="flex items-center gap-1 pt-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]">
                          {isExpanded ? (
                            <ChevronUp className="h-2.5 w-2.5 mr-0.5" />
                          ) : (
                            <ChevronDown className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {comments.length}
                        </Button>
                      </CollapsibleTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => {
                          setReplyingToNoteId(replyingToNoteId === note.id ? null : note.id);
                          if (!isExpanded) toggleNoteExpanded(note.id);
                        }}
                      >
                        <Reply className="h-2.5 w-2.5 mr-0.5" />
                        Reply
                      </Button>
                    </div>

                    <CollapsibleContent className="space-y-1.5 mt-1.5">
                      {/* Existing Comments */}
                      {comments.length > 0 && (
                        <div className="space-y-1 pl-2 border-l border-muted-foreground/20">
                          {comments
                            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                            .map((comment) => (
                              <div key={comment.id} className="text-[10px] py-1 px-1.5 bg-background rounded">
                                <p className="text-foreground leading-relaxed">{comment.comment_text}</p>
                                <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                                  <span className="font-medium">{comment.profiles?.full_name || comment.profiles?.email?.split('@')[0] || "Unknown"}</span>
                                  <span>•</span>
                                  <span>{format(parseISO(comment.created_at), "MMM d, h:mm a")}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Add Comment Form */}
                      {replyingToNoteId === note.id && (
                        <div className="flex gap-1 mt-1">
                          <Input
                            placeholder="Reply..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="h-6 text-[10px] px-2"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(note.id);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-6 px-2"
                            disabled={!newComment.trim() || addCommentMutation.isPending}
                            onClick={() => handleAddComment(note.id)}
                          >
                            {addCommentMutation.isPending ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Send className="h-2.5 w-2.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The note and all its comments will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteNoteId && deleteNoteMutation.mutate(deleteNoteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
