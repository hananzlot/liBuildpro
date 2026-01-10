import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Plus, Loader2, Trash2, MessageSquare, User, Reply, ChevronDown, ChevronUp } from "lucide-react";
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
    <div className="space-y-4">
      {/* Add Note Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Add Note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Enter your note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={3}
          />
          <Button
            onClick={handleAddNote}
            disabled={!newNote.trim() || addNoteMutation.isPending}
            size="sm"
          >
            {addNoteMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Note
          </Button>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Notes History</CardTitle>
          <CardDescription>{notes.length} note{notes.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No notes yet. Add your first note above.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const comments = note.project_note_comments || [];
                const isExpanded = expandedNotes.has(note.id);
                
                return (
                  <div
                    key={note.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">{note.note_text}</p>
                      {canDeleteNotes && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setDeleteNoteId(note.id)}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{note.profiles?.full_name || note.profiles?.email || "Unknown"}</span>
                      <span>•</span>
                      <span>{format(parseISO(note.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>

                    {/* Comments Section */}
                    <div className="pt-2 border-t mt-2">
                      <Collapsible open={isExpanded} onOpenChange={() => toggleNoteExpanded(note.id)}>
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3 mr-1" />
                              ) : (
                                <ChevronDown className="h-3 w-3 mr-1" />
                              )}
                              {comments.length} comment{comments.length !== 1 ? 's' : ''}
                            </Button>
                          </CollapsibleTrigger>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setReplyingToNoteId(replyingToNoteId === note.id ? null : note.id);
                              if (!isExpanded) toggleNoteExpanded(note.id);
                            }}
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                        </div>

                        <CollapsibleContent className="space-y-2 mt-2">
                          {/* Existing Comments */}
                          {comments.length > 0 && (
                            <div className="space-y-2 pl-4 border-l-2 border-muted">
                              {comments
                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                .map((comment) => (
                                  <div key={comment.id} className="text-xs space-y-1 bg-muted/50 rounded p-2">
                                    <p className="text-foreground">{comment.comment_text}</p>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <User className="h-2.5 w-2.5" />
                                      <span>{comment.profiles?.full_name || comment.profiles?.email || "Unknown"}</span>
                                      <span>•</span>
                                      <span>{format(parseISO(comment.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* Add Comment Form */}
                          {replyingToNoteId === note.id && (
                            <div className="flex gap-2 mt-2">
                              <Input
                                placeholder="Add a comment..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="h-8 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddComment(note.id);
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                className="h-8 px-3"
                                disabled={!newComment.trim() || addCommentMutation.isPending}
                                onClick={() => handleAddComment(note.id)}
                              >
                                {addCommentMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Send"
                                )}
                              </Button>
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
