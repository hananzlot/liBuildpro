
# Plan: Fix AI Estimate Generation Reliability and Progress UI Visibility

## Overview
This plan addresses two issues:
1. The progress indicator is hidden behind the estimate dialog
2. The AI generation failed due to a temporary service outage with no retry mechanism

---

## Part 1: Fix Progress Overlay Z-Index (UI Fix)

### Problem
The `AIGenerationProgress` component uses `z-50`, but the Radix Dialog's portal also uses `z-50` and renders later in the DOM, causing the dialog to cover the progress overlay.

### Solution
Increase the z-index of the progress overlay to `z-[100]` so it appears above the dialog overlay (`z-50`).

### File Changes
**`src/components/estimates/AIGenerationProgress.tsx`**
- Change line 83 from `z-50` to `z-[100]`

```tsx
// Before
<div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">

// After  
<div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
```

---

## Part 2: Improve Error Handling and Add Retry Logic (Backend Fix)

### Problem
The Gemini API via OpenRouter returned a 503 (temporarily unavailable) error. The system failed immediately without retrying.

### Solution
Add retry logic with exponential backoff for transient errors (503, 429, 502).

### File Changes
**`supabase/functions/generate-estimate-scope/index.ts`**

1. **Add retry helper function:**
```typescript
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on transient errors
      if (response.status === 503 || response.status === 502 || response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        console.log(`API returned ${response.status}, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      const waitTime = Math.pow(2, attempt) * 2000;
      console.log(`Network error, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}
```

2. **Replace the `fetch()` call** to the AI API with `fetchWithRetry()`

3. **Add clearer error messages** for specific failure cases:
   - 503: "AI service temporarily unavailable. Please try again in a few moments."
   - 429: "AI service rate limited. Please wait a moment and try again."
   - Timeout: "AI took too long to respond. Try with a smaller file or simpler description."

---

## Part 3: Add Timeout Protection (Optional Enhancement)

### Problem
Large PDFs can cause the AI to process for a very long time, exceeding edge function limits.

### Solution
Add an AbortController with a 90-second timeout to fail gracefully instead of hanging.

### File Changes
**`supabase/functions/generate-estimate-scope/index.ts`**

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout

try {
  const response = await fetchWithRetry(apiUrl, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  // ... process response
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('AI processing timed out. Try with a smaller file or simpler work scope.');
  }
  throw error;
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/estimates/AIGenerationProgress.tsx` | Increase z-index from `z-50` to `z-[100]` |
| `supabase/functions/generate-estimate-scope/index.ts` | Add `fetchWithRetry()` function with exponential backoff |
| `supabase/functions/generate-estimate-scope/index.ts` | Add 90-second timeout with AbortController |
| `supabase/functions/generate-estimate-scope/index.ts` | Improve error messages for 503, 429, and timeout errors |

---

## Technical Notes

- The 503 error was from OpenRouter (the gateway to Gemini), not from your code
- Retry logic with exponential backoff (2s, 4s, 8s delays) gives transient issues time to resolve
- The z-index fix is simple but effective since Dialog uses z-50 and we need to be above it
- The timeout protects against edge function execution limits (typically 60-120 seconds)
