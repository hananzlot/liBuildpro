import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Image as ImageIcon, 
  Grid3X3, 
  List, 
  Calendar,
  Download,
  ZoomIn,
  X,
  Upload,
  Loader2,
  Camera
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PortalPhotosProps {
  documents: any[];
  projectId: string;
  uploadLimitMb?: number;
}

type ViewMode = 'timeline' | 'categorized' | 'grid';

export function PortalPhotos({ documents, projectId, uploadLimitMb = 15 }: PortalPhotosProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const maxFileSize = uploadLimitMb * 1024 * 1024;

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
        // Validate file size
        if (file.size > maxFileSize) {
          toast.error(`${file.name} exceeds ${uploadLimitMb}MB limit`);
          continue;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `customer-uploads/${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('project-attachments')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('project-attachments')
          .getPublicUrl(fileName);

        // Insert document record
        const { error: dbError } = await supabase
          .from('project_documents')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            category: 'Customer Upload',
            notes: 'Uploaded by customer via portal'
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

  return (
    <div className="space-y-6">
      {/* Premium Header Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Project Photos</h2>
                <p className="text-sm text-slate-500">
                  {images.length} photo{images.length !== 1 ? 's' : ''} • Max {uploadLimitMb}MB per file
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
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
                className="flex-1 sm:flex-none shadow-md"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photos
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Mode Toggle */}
      {images.length > 0 && (
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-lg"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="rounded-lg"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'categorized' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('categorized')}
              className="rounded-lg"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Photos Yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Project photos will appear here as work progresses. You can also upload your own photos.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="lg"
              className="shadow-md"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Your First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {images.map((img: any) => (
                <ImageCard 
                  key={img.id} 
                  image={img} 
                  onClick={() => setSelectedImage(img)}
                  showDate
                />
              ))}
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="space-y-8">
              {Object.entries(imagesByDate)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([date, dateImages]) => (
                  <Card key={date} className="border-0 shadow-lg overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                          </CardTitle>
                          <p className="text-sm text-slate-500">{(dateImages as any[]).length} photos</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(dateImages as any[]).map((img: any) => (
                          <ImageCard 
                            key={img.id} 
                            image={img} 
                            onClick={() => setSelectedImage(img)}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* Categorized View */}
          {viewMode === 'categorized' && (
            <div className="space-y-6">
              {Object.entries(imagesByCategory).map(([category, categoryImages]) => (
                <Card key={category} className="border-0 shadow-lg overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                      {category}
                      {category === 'Customer Upload' && (
                        <Badge className="bg-primary/10 text-primary border-0">Your Uploads</Badge>
                      )}
                      <Badge variant="secondary" className="ml-auto">{(categoryImages as any[]).length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(categoryImages as any[]).map((img: any) => (
                        <ImageCard 
                          key={img.id} 
                          image={img} 
                          onClick={() => setSelectedImage(img)}
                          showDate
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Premium Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-0 shadow-2xl">
          {selectedImage && (
            <div className="relative bg-black">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
              <img
                src={selectedImage.file_url}
                alt={selectedImage.file_name}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
              <div className="p-5 bg-white">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 truncate">{selectedImage.file_name}</p>
                      {selectedImage.category === 'Customer Upload' && (
                        <Badge className="bg-primary/10 text-primary border-0 shrink-0">Your Upload</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {format(new Date(selectedImage.created_at), 'MMMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <a href={selectedImage.file_url} download={selectedImage.file_name}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageCard({ 
  image, 
  onClick, 
  showDate = false 
}: { 
  image: any; 
  onClick: () => void;
  showDate?: boolean;
}) {
  return (
    <div 
      className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-slate-100 shadow-sm hover:shadow-lg transition-all duration-300"
      onClick={onClick}
    >
      <img
        src={image.file_url}
        alt={image.file_name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
        <div className="text-white text-xs">
          {showDate && format(new Date(image.created_at), 'MMM d')}
        </div>
        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <ZoomIn className="h-4 w-4 text-white" />
        </div>
      </div>
      {image.category === 'Customer Upload' && (
        <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
          You
        </Badge>
      )}
    </div>
  );
}
