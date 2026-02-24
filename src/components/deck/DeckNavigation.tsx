import React, { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";

interface DeckNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onNavigate: (index: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  thumbnails: React.ReactNode[];
}

export function DeckNavigation({
  currentSlide,
  totalSlides,
  onNavigate,
  isFullscreen,
  onToggleFullscreen,
  thumbnails,
}: DeckNavigationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        onNavigate(Math.min(currentSlide + 1, totalSlides - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate(Math.max(currentSlide - 1, 0));
      } else if (e.key === "Escape" && isFullscreen) {
        document.exitFullscreen?.();
      }
    },
    [currentSlide, totalSlides, onNavigate, isFullscreen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isFullscreen) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-full px-4 py-2 text-white/80 text-sm opacity-0 hover:opacity-100 transition-opacity duration-300">
        <button onClick={() => onNavigate(Math.max(currentSlide - 1, 0))} className="p-1 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
        <span>{currentSlide + 1} / {totalSlides}</span>
        <button onClick={() => onNavigate(Math.min(currentSlide + 1, totalSlides - 1))} className="p-1 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
        <button onClick={onToggleFullscreen} className="p-1 hover:text-white ml-2"><Minimize className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thumbnail strip */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {thumbnails.map((thumb, i) => (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            className={`w-full aspect-video rounded-lg overflow-hidden border-2 transition-all ${
              i === currentSlide ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
            }`}
          >
            {thumb}
          </button>
        ))}
      </div>

      {/* Bottom controls */}
      <div className="border-t border-border p-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => onNavigate(Math.max(currentSlide - 1, 0))} className="p-1.5 rounded hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{currentSlide + 1} / {totalSlides}</span>
          <button onClick={() => onNavigate(Math.min(currentSlide + 1, totalSlides - 1))} className="p-1.5 rounded hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button onClick={onToggleFullscreen} className="p-1.5 rounded hover:bg-muted" title="Fullscreen">
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
