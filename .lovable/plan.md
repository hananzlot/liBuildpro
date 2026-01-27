

# Plan: Implement OpenAI Files API for PDF Uploads

## Overview
Modify the `generate-estimate-scope` edge function to upload PDF files to OpenAI's `/v1/files` endpoint, then reference the `file_id` in the chat completion request. This allows ChatGPT to analyze both the text content and visual diagrams in your construction plans.

## How It Works

```text
┌─────────────────────────────────────────────────────────────┐
│  1. User uploads PDF to Supabase Storage (estimate-plans)  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Edge function fetches PDF from Supabase Storage URL    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Upload PDF to OpenAI /v1/files endpoint                │
│     - purpose: "user_data"                                  │
│     - Returns file_id (e.g., "file-abc123...")             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Call Chat Completions with file reference              │
│     content: [                                              │
│       { type: "file", file: { file_id: "file-abc123" } },  │
│       { type: "text", text: "Generate estimate..." }       │
│     ]                                                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  5. ChatGPT analyzes PDF (text + page images)              │
│     - Extracts specifications text                          │
│     - "Sees" floor plans, elevations, diagrams             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Returns detailed estimate JSON                          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Step 1: Add PDF Upload Function to Edge Function

```typescript
// New helper function in generate-estimate-scope/index.ts

async function uploadPdfToOpenAI(
  pdfBuffer: ArrayBuffer, 
  filename: string, 
  apiKey: string
): Promise<string> {
  const formData = new FormData();
  formData.append('purpose', 'user_data');
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);

  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload PDF to OpenAI: ${error}`);
  }

  const data = await response.json();
  return data.id; // Returns file_id like "file-abc123..."
}
```

### Step 2: Update PDF Handling Logic

Replace the current placeholder logic (lines 132-135) with actual upload:

```typescript
if (contentType.includes('application/pdf')) {
  console.log('PDF plans file detected - uploading to OpenAI...');
  const pdfBuffer = await plansResponse.arrayBuffer();
  const filename = `construction-plans-${Date.now()}.pdf`;
  
  try {
    const fileId = await uploadPdfToOpenAI(pdfBuffer, filename, openaiApiKey);
    parsedPlansContent = { type: 'file_id', value: fileId };
    console.log('PDF uploaded to OpenAI, file_id:', fileId);
  } catch (uploadError) {
    console.error('Failed to upload PDF to OpenAI:', uploadError);
    // Fallback to description-based if upload fails
    parsedPlansContent = { type: 'text', value: '[PDF upload failed - using description only]' };
  }
}
```

### Step 3: Update Message Structure for OpenAI

Modify the messages array to use the new file input format:

```typescript
// Build user message content array
const userContent: any[] = [];

// Add file reference if PDF was uploaded
if (parsedPlansContent?.type === 'file_id') {
  userContent.push({
    type: 'file',
    file: { file_id: parsedPlansContent.value }
  });
}

// Add the text prompt
userContent.push({
  type: 'text',
  text: userPrompt
});

// Build messages array
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userContent }
];
```

### Step 4: Keep Image Support Working

Images will continue to work as before (base64 inline):

```typescript
if (contentType.includes('image/')) {
  // Existing image handling remains unchanged
  const imageBuffer = await plansResponse.arrayBuffer();
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
  const mimeType = contentType.split(';')[0];
  parsedPlansContent = { 
    type: 'image_url', 
    value: `data:${mimeType};base64,${base64Image}` 
  };
}
```

### Step 5: Also Fix the Per-Unit Cost Issue

While updating the function, we'll also strengthen the prompt to ensure ChatGPT returns per-unit costs (not totals):

```text
**CRITICAL - COST FIELD RULES:**
- "labor_cost" = RATE PER UNIT (e.g., $50/hour, NOT $500 for 10 hours)
- "material_cost" = PRICE PER UNIT (e.g., $8/sqft, NOT $800 for 100 sqft)
- NEVER multiply costs by quantity - return the UNIT RATE only

CORRECT: 2000 board feet of lumber at $2/bf → quantity: 2000, material_cost: 2
WRONG: material_cost: 4000 for 2000 board feet (this is the total, not per-unit!)
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-estimate-scope/index.ts` | Add PDF upload function, update message structure, fix cost prompt |

## Technical Considerations

### File Size Limits
- OpenAI Files API supports up to **512 MB** per file
- Your `estimate-plans` bucket limit is 200MB - well within range

### Token Usage
- PDF pages are converted to images by OpenAI
- ~1,000-2,000 tokens per page (depending on complexity)
- A 10-page construction plan ≈ 10,000-20,000 input tokens

### Model Selection
- Must use `gpt-4o` (not gpt-4o-mini) for file/vision support
- gpt-4o-mini does NOT support file inputs

### Cleanup (Optional)
- OpenAI stores uploaded files until deleted
- Could add cleanup logic to delete file after estimate generation
- Or let them accumulate (they don't count against storage limits significantly)

## Expected Outcome

After implementation:
- PDF construction plans will be fully analyzed by ChatGPT
- ChatGPT will "see" floor plans, elevations, and diagrams
- Text specifications will be extracted and understood
- Estimates will be based on actual plan content, not just descriptions

