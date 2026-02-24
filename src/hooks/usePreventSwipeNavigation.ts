import { useEffect } from "react";

/**
 * Prevents horizontal trackpad swipes from triggering browser back/forward navigation.
 * Uses the CSS overscroll-behavior property which is the modern, non-invasive approach.
 * This avoids interfering with normal scroll behavior (mouse wheel, trackpad vertical scroll).
 */
export function usePreventSwipeNavigation() {
  useEffect(() => {
    // The CSS overscroll-behavior-x: none property prevents the browser from
    // interpreting horizontal overscroll as a back/forward navigation gesture.
    // This is the recommended approach — no JS wheel/touch interception needed.
    document.documentElement.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";

    return () => {
      document.documentElement.style.overscrollBehaviorX = "";
      document.body.style.overscrollBehaviorX = "";
    };
  }, []);
}
