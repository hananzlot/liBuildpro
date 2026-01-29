import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Image as ImageIcon, 
  Grid3X3, 
  LayoutList, 
  Layers,
  Download,
  ZoomIn,
  X,
  Upload,
  Loader2,
  Camera,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PortalPhotosProps {
  documents: any[];
  projectId: string;
  uploadLimitMb?: number;
  companyId?: string | null;
}

type ViewMode = 'grid' | 'timeline' | 'categorized';

export function PortalPhotos({ documents, projectId, uploadLimitMb = 15, companyId }: PortalPhotosProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
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
        if (file.size > maxFileSize) {
          toast.error(`${file.name} exceeds ${uploadLimitMb}MB limit`);
          continue;
        }

        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

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
            category: 'Customer Upload',
            notes: 'Uploaded by customer via portal',
            company_id: companyId || null,
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

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <Card className="border-0 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Camera className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Project Photos</h2>
                <p className="text-white/70 text-sm mt-1">
                  {images.length} photo{images.length !== 1 ? 's' : ''} • Max {uploadLimitMb}MB per file
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
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
                variant="secondary"
                className="w-full sm:w-auto shadow-lg bg-white text-purple-700 hover:bg-white/90"
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
        </div>
      </Card>

      {/* View Mode Toggle */}
      {images.length > 0 && (
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-1 bg-white rounded-xl p-1.5 shadow-lg border border-slate-200">
            {viewModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <Button
                  key={mode.value}
                  variant={viewMode === mode.value ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode(mode.value)}
                  className={`rounded-lg gap-2 ${viewMode === mode.value ? '' : 'text-slate-500'}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{mode.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {images.length === 0 ? (
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="py-20 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Photos Yet</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              Project photos will appear here as work progresses. You can also upload your own photos to share with the team.
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="lg"
              className="shadow-lg"
            >
              <Upload className="h-5 w-5 mr-2" />
              Upload Your First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {images.map((img: any, index: number) => (
                <ImageCard 
                  key={img.id} 
                  image={img} 
                  onClick={() => openLightbox(img, index)}
                  showDate
                />
              ))}
            </div>
          )}

          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <div className="space-y-6">
              {Object.entries(imagesByDate)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([date, dateImages]) => (
                  <Card key={date} className="border-0 shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                          <span className="text-lg font-bold text-slate-700">
                            {format(new Date(date), 'd')}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {format(new Date(date), 'EEEE')}
                          </p>
                          <p className="text-sm text-slate-500">
                            {format(new Date(date), 'MMMM yyyy')} • {(dateImages as any[]).length} photos
                          </p>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {(dateImages as any[]).map((img: any) => {
                          const globalIndex = images.findIndex(i => i.id === img.id);
                          return (
                            <ImageCard 
                              key={img.id} 
                              image={img} 
                              onClick={() => openLightbox(img, globalIndex)}
                            />
                          );
                        })}
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
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{category}</h3>
                        {category === 'Customer Upload' && (
                          <Badge className="bg-purple-100 text-purple-700 border-0">Your Uploads</Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        {(categoryImages as any[]).length}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      {(categoryImages as any[]).map((img: any) => {
                        const globalIndex = images.findIndex(i => i.id === img.id);
                        return (
                          <ImageCard 
                            key={img.id} 
                            image={img} 
                            onClick={() => openLightbox(img, globalIndex)}
                            showDate
                          />
                        );
                      })}
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
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-0 shadow-2xl bg-black/95">
          {selectedImage && (
            <div className="relative">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
              
              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full h-12 w-12"
                    onClick={() => navigateLightbox('prev')}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full h-12 w-12"
                    onClick={() => navigateLightbox('next')}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
              
              {/* Image */}
              <div className="flex items-center justify-center min-h-[50vh] max-h-[70vh] p-4">
                <img
                  src={selectedImage.file_url}
                  alt={selectedImage.file_name}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg"
                />
              </div>
              
              {/* Info Bar */}
              <div className="p-5 bg-slate-900 border-t border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-white truncate">{selectedImage.file_name}</p>
                      {selectedImage.category === 'Customer Upload' && (
                        <Badge className="bg-purple-500/20 text-purple-300 border-0 shrink-0">
                          Your Upload
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">
                      {format(new Date(selectedImage.created_at), 'MMMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-slate-500">
                      {selectedIndex + 1} / {images.length}
                    </span>
                    <Button variant="outline" size="sm" asChild className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                      <a href={selectedImage.file_url} download={selectedImage.file_name}>
                        <Download className="h-4 w-4 mr-2" />
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
      className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-slate-100 shadow-md hover:shadow-xl transition-all duration-300 ring-1 ring-slate-200 hover:ring-primary/50"
      onClick={onClick}
    >
      <img
        src={image.file_url}
        alt={image.file_name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2">
          <ZoomIn className="h-6 w-6 text-white" />
        </div>
        {showDate && (
          <p className="text-white text-xs">{format(new Date(image.created_at), 'MMM d')}</p>
        )}
      </div>
      {image.category === 'Customer Upload' && (
        <Badge className="absolute top-2 left-2 bg-purple-500 text-white text-[10px] px-2 py-0.5 shadow-lg">
          You
        </Badge>
      )}
    </div>
  );
}