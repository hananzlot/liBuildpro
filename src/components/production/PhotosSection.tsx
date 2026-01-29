import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Image as ImageIcon, 
  Grid3X3, 
  LayoutList, 
  Layers,
  Download,
  X,
  Upload,
  Loader2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
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

interface PhotosSectionProps {
  projectId: string;
  uploadLimitMb?: number;
}

type ViewMode = 'grid' | 'timeline' | 'categorized';

export function PhotosSection({ projectId, uploadLimitMb = 15 }: PhotosSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const maxFileSize = uploadLimitMb * 1024 * 1024;

  // Fetch all project documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Filter to only show images
  const images = documents.filter(doc => 
    doc.file_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name)
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;

    try {
      for (const file of Array.from(files)) {
        if (file.size > maxFileSize) {
          toast.error(`${file.name} exceeds ${uploadLimitMb}MB limit`);
          continue;
        }

        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `project-photos/${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('project-attachments')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            category: 'Project Photo',
            notes: 'Uploaded via project detail'
          });

        if (dbError) {
          console.error('DB error:', dbError);
          toast.error(`Failed to save ${file.name}`);
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} photo${successCount > 1 ? 's' : ''}`);
        queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project-portal'] });
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload photos');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return;
    
    try {
      // Extract the storage path from the URL
      const url = new URL(photoToDelete.file_url);
      const pathMatch = url.pathname.match(/\/object\/public\/project-attachments\/(.+)/);
      
      if (pathMatch) {
        // Try to delete from storage
        await supabase.storage
          .from('project-attachments')
          .remove([pathMatch[1]]);
      }
      
      // Delete the database record
      const { error } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', photoToDelete.id);

      if (error) throw error;

      toast.success('Photo deleted');
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-portal'] });
      
      // Close lightbox if deleting current image
      if (selectedImage?.id === photoToDelete.id) {
        setSelectedImage(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete photo');
    } finally {
      setDeleteDialogOpen(false);
      setPhotoToDelete(null);
    }
  };

  const openLightbox = (image: any, index: number) => {
    setSelectedImage(image);
    setSelectedIndex(index);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? (selectedIndex - 1 + images.length) % images.length
      : (selectedIndex + 1) % images.length;
    setSelectedIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  // Group images by date for timeline view
  const imagesByDate = images.reduce((acc: Record<string, any[]>, img) => {
    const date = format(new Date(img.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(img);
    return acc;
  }, {});

  // Group images by category for categorized view
  const imagesByCategory = images.reduce((acc: Record<string, any[]>, img) => {
    const category = img.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(img);
    return acc;
  }, {});

  const viewModes = [
    { value: 'grid' as ViewMode, icon: Grid3X3, label: 'Grid' },
    { value: 'timeline' as ViewMode, icon: LayoutList, label: 'Timeline' },
    { value: 'categorized' as ViewMode, icon: Layers, label: 'Category' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Upload */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-medium flex items-center gap-2">
              <Camera className="h-3 w-3" />
              Project Photos
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-2">
                {images.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              {images.length > 0 && (
                <div className="inline-flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                  {viewModes.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <Button
                        key={mode.value}
                        variant={viewMode === mode.value ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode(mode.value)}
                        className="h-6 w-6 p-0"
                        title={mode.label}
                      >
                        <Icon className="h-3 w-3" />
                      </Button>
                    );
                  })}
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                size="sm"
                className="h-7 text-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3 mr-1.5" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {images.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mb-3">No photos yet</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                size="sm"
                variant="outline"
              >
                <Upload className="h-3 w-3 mr-1.5" />
                Upload First Photo
              </Button>
            </div>
          ) : (
            <>
              {/* Grid View */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.map((img: any, index: number) => (
                    <ImageCard 
                      key={img.id} 
                      image={img} 
                      onClick={() => openLightbox(img, index)}
                      onDelete={() => {
                        setPhotoToDelete(img);
                        setDeleteDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Timeline View */}
              {viewMode === 'timeline' && (
                <div className="space-y-4">
                  {Object.entries(imagesByDate)
                    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                    .map(([date, dateImages]) => (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium">
                            {format(new Date(date), 'MMM d, yyyy')}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {(dateImages as any[]).length}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {(dateImages as any[]).map((img: any) => {
                            const globalIndex = images.findIndex(i => i.id === img.id);
                            return (
                              <ImageCard 
                                key={img.id} 
                                image={img} 
                                onClick={() => openLightbox(img, globalIndex)}
                                onDelete={() => {
                                  setPhotoToDelete(img);
                                  setDeleteDialogOpen(true);
                                }}
                                compact
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Categorized View */}
              {viewMode === 'categorized' && (
                <div className="space-y-4">
                  {Object.entries(imagesByCategory).map(([category, categoryImages]) => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium">{category}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {(categoryImages as any[]).length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {(categoryImages as any[]).map((img: any) => {
                          const globalIndex = images.findIndex(i => i.id === img.id);
                          return (
                            <ImageCard 
                              key={img.id} 
                              image={img} 
                              onClick={() => openLightbox(img, globalIndex)}
                              onDelete={() => {
                                setPhotoToDelete(img);
                                setDeleteDialogOpen(true);
                              }}
                              compact
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-0 bg-background">
          {selectedImage && (
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-20 bg-background/80 hover:bg-background rounded-full h-8 w-8"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              
              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background rounded-full h-8 w-8"
                    onClick={() => navigateLightbox('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-background/80 hover:bg-background rounded-full h-8 w-8"
                    onClick={() => navigateLightbox('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              {/* Image */}
              <div className="flex items-center justify-center min-h-[40vh] max-h-[60vh] p-4 bg-muted/50">
                <img
                  src={selectedImage.file_url}
                  alt={selectedImage.file_name}
                  className="max-w-full max-h-[55vh] object-contain rounded"
                />
              </div>
              
              {/* Info Bar */}
              <div className="p-3 border-t">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{selectedImage.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedImage.created_at), 'MMM d, yyyy • h:mm a')}
                      {selectedImage.category && ` • ${selectedImage.category}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {selectedIndex + 1} / {images.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        setPhotoToDelete(selectedImage);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" asChild className="h-7">
                      <a href={selectedImage.file_url} download={selectedImage.file_name}>
                        <Download className="h-3 w-3 mr-1.5" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ImageCard({ 
  image, 
  onClick, 
  onDelete,
  compact = false 
}: { 
  image: any; 
  onClick: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  return (
    <div 
      className={`group relative ${compact ? 'aspect-square' : 'aspect-[4/3]'} rounded-lg overflow-hidden cursor-pointer bg-muted ring-1 ring-border hover:ring-primary/50 transition-all`}
      onClick={onClick}
    >
      <img
        src={image.file_url}
        alt={image.file_name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Delete button on hover */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-all"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      
      {/* Category badge */}
      {image.category === 'Customer Upload' && (
        <Badge className="absolute bottom-1 left-1 text-[8px] px-1 py-0 bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity">
          Customer
        </Badge>
      )}
    </div>
  );
}
