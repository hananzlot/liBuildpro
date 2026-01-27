
# Plan: Switch AI Estimate Generation to Use Your OpenAI API Key

## Overview
Modify the `generate-estimate-scope` edge function to use your company's OpenAI API key stored in `company_settings` instead of the Lovable AI Gateway. This gives you full control over AI costs and allows you to use ChatGPT/OpenAI models directly.

## Implementation Steps

### Step 1: Update Edge Function to Fetch OpenAI API Key
Modify `supabase/functions/generate-estimate-scope/index.ts` to:
- Fetch `openai_api_key` from `company_settings` table alongside existing AI settings
- Fall back to `app_settings` if no company-specific key exists (platform default)

### Step 2: Switch API Endpoint and Model
Change the AI API call from:
- **Current**: `https://ai.gateway.lovable.dev/v1/chat/completions` with `google/gemini-3-flash-preview`
- **New**: `https://api.openai.com/v1/chat/completions` with `gpt-4o-mini` (cost-effective) or `gpt-4o`

### Step 3: Update Authorization Header
Change from using `LOVABLE_API_KEY` to using the fetched OpenAI API key from your company settings.

### Step 4: Add Model Configuration (Optional Enhancement)
Add a new company setting `ai_estimate_model` to let you choose which OpenAI model to use (gpt-4o-mini, gpt-4o, etc.).

### Step 5: Update Error Handling
Adjust error messages for OpenAI-specific errors (rate limits, quota exceeded, invalid key).

---

## Technical Details

### Database Query Addition
```sql
-- Fetch from company_settings, with fallback to app_settings
.in('setting_key', ['ai_estimate_variability', 'ai_estimate_instructions', 'openai_api_key'])
```

### API Call Change
```typescript
// FROM:
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({ model: 'google/gemini-3-flash-preview', ... })
});

// TO:
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${openaiApiKey}` },
  body: JSON.stringify({ model: 'gpt-4o-mini', ... })
});
```

### Model Selection Logic
- **Default**: `gpt-4o-mini` (fast, cheap at ~$0.01 per estimate)
- **For images/vision**: `gpt-4o` (supports image analysis)
- **Optional**: Add admin setting to choose model

---

## Benefits
- **Cost Control**: You pay OpenAI directly, no Lovable credits consumed for AI
- **Model Choice**: Use any OpenAI model (GPT-4o, GPT-4o-mini, GPT-4 Turbo)
- **Transparency**: Direct billing from OpenAI with clear per-token pricing
- **No Rate Limits from Lovable**: Your own OpenAI rate limits apply

## Risks / Considerations
- Requires valid OpenAI API key with sufficient credits
- OpenAI API has its own rate limits (varies by plan tier)
- Vision/image analysis requires GPT-4o or GPT-4 Turbo (not GPT-4o-mini)

---

## Files to Modify
1. `supabase/functions/generate-estimate-scope/index.ts` - Main changes to use OpenAI API
