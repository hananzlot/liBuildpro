export function CancelledWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-start overflow-hidden pl-12">
      <span
        className="select-none text-destructive/20 font-black uppercase tracking-widest"
        style={{
          fontSize: "clamp(3rem, 10vw, 8rem)",
          transform: "rotate(-30deg)",
          whiteSpace: "nowrap",
        }}
      >
        Cancelled
      </span>
    </div>
  );
}
