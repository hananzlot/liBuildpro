import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface PortalPhotosProps {
  documents: any[];
}

type ViewMode = 'timeline' | 'categorized' | 'grid';

export function PortalPhotos({ documents }: PortalPhotosProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedImage, setSelectedImage] = useState<any | null>(null);

  // Filter to only show images
  const images = documents.filter(doc => 
    doc.file_type?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name)
  );

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Photos Yet</h3>
          <p className="text-muted-foreground">
            Project photos will appear here as work progresses.
          </p>
        </CardContent>
      </Card>
    );
  }

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
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Project Photos ({images.length})</h2>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('timeline')}
          >
            <List className="h-4 w-4 mr-2" />
            Timeline
          </Button>
          <Button
            variant={viewMode === 'categorized' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('categorized')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Categorized
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4 mr-2" />
            Grid
          </Button>
        </div>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="space-y-8">
          {Object.entries(imagesByDate)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([date, dateImages]) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">
                    {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <Badge variant="secondary">{(dateImages as any[]).length} photos</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(dateImages as any[]).map((img: any) => (
                    <ImageCard 
                      key={img.id} 
                      image={img} 
                      onClick={() => setSelectedImage(img)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Categorized View */}
      {viewMode === 'categorized' && (
        <div className="space-y-8">
          {Object.entries(imagesByCategory).map(([category, categoryImages]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
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

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0">
          {selectedImage && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={selectedImage.file_url}
                alt={selectedImage.file_name}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="p-4 bg-background border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedImage.file_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedImage.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                    {selectedImage.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedImage.notes}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
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
      className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer border bg-muted"
      onClick={onClick}
    >
      <img
        src={image.file_url}
        alt={image.file_name}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {showDate && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
          <p className="text-xs text-white">
            {format(new Date(image.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      )}
    </div>
  );
}
