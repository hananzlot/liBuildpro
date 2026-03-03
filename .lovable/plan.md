

## Plan: Make the Super Admin UI control the platform Resend API key

**Problem**: The edge functions read `RESEND_API_KEY` from `Deno.env` (Supabase secrets), but the Super Admin UI saves to the `app_settings` database table. They're disconnected — changing the key in the UI does nothing.

**Solution**: Update `getResendApiKey()` in `supabase/functions/_shared/get-resend-key.ts` to first check `app_settings` for a `resend_api_key` row, and fall back to `Deno.env.get("RESEND_API_KEY")` if not found.

### Changes

1. **Update `get-resend-key.ts`** — modify `getResendApiKey()` to:
   - Accept a service-role Supabase client (already passed but ignored as `_supabase`)
   - Query `app_settings` for `setting_key = 'resend_api_key'`
   - If found and non-empty, use that value
   - Otherwise fall back to `Deno.env.get("RESEND_API_KEY")`

2. **Seed the `app_settings` row** — create a migration to insert a `resend_api_key` row in `app_settings` if it doesn't exist (empty value), so the UI can display and update it.

3. **Redeploy all edge functions** that import `get-resend-key.ts` (11 functions) so they pick up the new logic.

4. **Update `manage-email-domain/index.ts`** — it reads `RESEND_API_KEY` directly from `Deno.env`. Change it to also use the shared `getResendApiKey()` function for consistency.

### Technical detail

The `getResendApiKey` function will change from:
```ts
// Current: only reads env var
return Deno.env.get("RESEND_API_KEY") || null;
```
To:
```ts
// New: DB first, env fallback
const { data } = await supabase
  .from("app_settings")
  .select("setting_value")
  .eq("setting_key", "resend_api_key")
  .maybeSingle();

if (data?.setting_value) return data.setting_value;
return Deno.env.get("RESEND_API_KEY") || null;
```

This means you can manage the key from Super Admin → App Default Settings, and all email functions will use it immediately without redeploying.

