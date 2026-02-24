import { useState, useCallback, useEffect } from "react";
import { ScaledSlide } from "@/components/deck/SlideLayout";
import { DeckNavigation } from "@/components/deck/DeckNavigation";

import SlideTitle from "@/components/deck/slides/SlideTitle";
import SlideProblem from "@/components/deck/slides/SlideProblem";
import SlideDashboard from "@/components/deck/slides/SlideDashboard";
import SlideEstimates from "@/components/deck/slides/SlideEstimates";
import SlideProduction from "@/components/deck/slides/SlideProduction";
import SlideAnalytics from "@/components/deck/slides/SlideAnalytics";
import SlideClientPortal from "@/components/deck/slides/SlideClientPortal";
import SlideSalesPortal from "@/components/deck/slides/SlideSalesPortal";
import SlideDocSigning from "@/components/deck/slides/SlideDocSigning";
import SlideCTA from "@/components/deck/slides/SlideCTA";

const SLIDES = [
  <SlideTitle />,
  <SlideProblem />,
  <SlideDashboard />,
  <SlideEstimates />,
  <SlideProduction />,
  <SlideAnalytics />,
  <SlideClientPortal />,
  <SlideSalesPortal />,
  <SlideDocSigning />,
  <SlideCTA />,
];

export default function Deck() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const thumbnails = SLIDES.map((slide, i) => (
    <ScaledSlide key={i} className="w-full aspect-video pointer-events-none">
      {slide}
    </ScaledSlide>
  ));

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-[9999]">
        <ScaledSlide className="w-full h-full">
          {SLIDES[current]}
        </ScaledSlide>
        <DeckNavigation
          currentSlide={current}
          totalSlides={SLIDES.length}
          onNavigate={setCurrent}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          thumbnails={thumbnails}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r border-border bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground truncate">Marketing Deck</h1>
        </div>
        <DeckNavigation
          currentSlide={current}
          totalSlides={SLIDES.length}
          onNavigate={setCurrent}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          thumbnails={thumbnails}
        />
      </div>

      {/* Main canvas */}
      <div className="flex-1 flex items-center justify-center bg-muted/10 p-8">
        <div className="w-full h-full max-w-[1400px] max-h-[800px] rounded-xl overflow-hidden shadow-2xl border border-border">
          <ScaledSlide className="w-full h-full">
            {SLIDES[current]}
          </ScaledSlide>
        </div>
      </div>
    </div>
  );
}
