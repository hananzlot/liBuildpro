import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, AlertCircle } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfCanvasViewerProps {
  fileUrl: string;
  className?: string;
}

export function PdfCanvasViewer({ fileUrl, className = '' }: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;

    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const task = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await task.promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;

          const containerWidth = container.clientWidth || 600;
          const viewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth - 16) / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          if (i > 1) canvas.style.marginTop = '8px';

          container.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
          }
        }
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error('PDF render error:', err);
          setError('Unable to load PDF document');
          setLoading(false);
        }
      }
    };

    renderPdf();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 p-8 ${className}`}>
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={containerRef} className="p-2" />
    </div>
  );
}
