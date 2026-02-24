import React, { useRef, useEffect, useState, useCallback } from "react";

const SLIDE_W = 1920;
const SLIDE_H = 1080;

interface SlideLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/** Renders children at a fixed 1920×1080 canvas, scaled to fit the parent container. */
export function SlideLayout({ children, className = "" }: SlideLayoutProps) {
  return (
    <div className={`slide-content relative w-[1920px] h-[1080px] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

interface ScaledSlideProps {
  children: React.ReactNode;
  className?: string;
}

/** Wrapper that measures its parent and applies CSS scale to the 1920×1080 slide. */
export function ScaledSlide({ children, className = "" }: ScaledSlideProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.15);

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setScale(Math.min(width / SLIDE_W, height / SLIDE_H));
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={{ width: "100%", height: "100%" }}>
      <div
        className="absolute"
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          left: "50%",
          top: "50%",
          marginLeft: -SLIDE_W / 2,
          marginTop: -SLIDE_H / 2,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
