

# Plan: Fix AI PDF Analysis - ChatGPT Is Not Reading the Plans

## Problem Identified

The PDF **is being uploaded successfully** to OpenAI, but ChatGPT is returning a **generic cookie-cutter estimate** instead of actually analyzing the construction plans.

Evidence from logs:
- PDF uploaded: `file-7mzLGgTXvku7zFWJmNrD2L` (32MB file)
- Output: Generic "2636 sqft new home" estimate with only ~13 groups
- No plan-specific details (no room names, no actual dimensions, no specifications from the PDF)

## Root Cause

The current prompt tells ChatGPT to "ANALYZE THE ATTACHED CONSTRUCTION PLANS PDF CAREFULLY" but:
1. This instruction is buried at the bottom of the prompt
2. The prompt leads with generic scope info, so ChatGPT just uses that
3. There's no emphasis on extracting PDF-specific data

## Solution: Restructure the Prompt

Modify the prompt to **force ChatGPT to analyze the PDF FIRST** before generating any estimates.

### Changes to `generate-estimate-scope/index.ts`

**1. Reorder the prompt when PDF is attached:**

Move the PDF analysis instruction to the TOP and make it mandatory:

```typescript
// When PDF is attached, front-load the analysis instruction
if (parsedPlansContent?.type === 'file_id') {
  userPrompt = `**CRITICAL: YOU MUST ANALYZE THE ATTACHED PDF FIRST**

I have attached construction plans as a PDF file. Before generating any estimate, you MUST:
1. Read EVERY page of the PDF
2. Extract ALL room names, dimensions, and square footages
3. Identify all specifications, materials, and finishes mentioned
4. Note any structural details (foundation type, framing, roofing)
5. List all MEP (plumbing, electrical, HVAC) specifications found

DO NOT generate a generic estimate. The estimate MUST reflect what is actually shown in the attached PDF plans.

---

${originalPrompt}

---

**MANDATORY PDF ANALYSIS CHECKLIST:**
- [ ] List every room from the floor plan with dimensions
- [ ] Identify roofing material and area from elevation drawings
- [ ] Note foundation type from structural drawings
- [ ] Extract any spec schedules (door, window, finish schedules)
- [ ] Include any specific material callouts from the plans

If you cannot read the PDF, say so explicitly. Do NOT make up generic values.`;
}
```

**2. Add explicit extraction request in system prompt:**

```typescript
const systemPromptWithPdf = `You are an expert construction estimator with strong plan-reading skills.

IMPORTANT: When PDF plans are attached:
- You MUST extract actual data from the plans
- Never generate generic estimates when plans are provided
- If you cannot read a detail, say "Unable to determine from plans"
- Quote specific page numbers when referencing plan details

Return COST values (what the contractor pays), not selling prices.`;
```

**3. Add validation of PDF analysis in response:**

Add instructions to include a new field showing what was extracted:

```typescript
// Add to JSON schema
"pdf_extracted_data": {
  "rooms_identified": ["Room name - dimensions"],
  "total_sqft_from_plans": number,
  "specifications_found": ["spec 1", "spec 2"],
  "unable_to_determine": ["items that couldn't be read"]
}
```

## File to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-estimate-scope/index.ts` | Restructure prompt to prioritize PDF analysis, add explicit extraction requirements |

## Expected Outcome

After this change:
- ChatGPT will be forced to analyze the PDF before generating estimates
- The estimate will include actual room names and dimensions from the plans
- Quantities will be based on extracted measurements, not guesses
- A new field will show what was extracted from the PDF for verification

## Why This Will Work

OpenAI's file analysis does work - the issue is prompt engineering. By:
1. Making PDF analysis the FIRST instruction (not buried at the end)
2. Requiring explicit extraction of details before estimating
3. Adding a checklist that ChatGPT must address
4. Asking for "unable to determine" items to catch failures

ChatGPT will be forced to engage with the PDF content rather than defaulting to generic estimates.

