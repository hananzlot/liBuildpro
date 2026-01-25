import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Base62 characters for short code generation
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function generateShortCode(length = 8): string {
  let result = "";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[randomBytes[i] % 62];
  }
  return result;
}

/**
 * Check if a company has the short_links feature enabled via their subscription.
 */
export async function isShortLinksEnabled(
  supabase: SupabaseClient,
  companyId: string
): Promise<boolean> {
  try {
    // Fetch the company's subscription with plan features
    const { data: subscription, error } = await supabase
      .from('company_subscriptions')
      .select(`
        features_override,
        plan:subscription_plans(features)
      `)
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle();

    if (error || !subscription) {
      return false;
    }

    const planFeatures = (subscription as any).plan?.features || {};
    const overrides = (subscription as any).features_override || {};
    const mergedFeatures = { ...planFeatures, ...overrides };
    return mergedFeatures['short_links'] === true;
  } catch (err) {
    console.error('Error checking short_links feature:', err);
    return false;
  }
}

/**
 * Get the app base URL for a company.
 */
export async function getCompanyBaseUrl(
  supabase: SupabaseClient,
  companyId: string
): Promise<string> {
  // Try company_settings first
  const { data: companySetting } = await supabase
    .from('company_settings')
    .select('setting_value')
    .eq('company_id', companyId)
    .eq('setting_key', 'app_base_url')
    .maybeSingle();

  if ((companySetting as any)?.setting_value) {
    return (companySetting as any).setting_value;
  }

  // Fall back to app_settings
  const { data: appSetting } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'app_base_url')
    .maybeSingle();

  return (appSetting as any)?.setting_value || 'https://crm.ca-probuilders.com';
}

interface CreateShortLinkOptions {
  longUrl: string;
  companyId: string;
  title?: string;
  customAlias?: string;
  createdByType?: 'internal_user' | 'customer' | 'salesperson' | 'system';
  createdById?: string;
}

/**
 * Create a short link for a company. Returns the short URL if successful,
 * or the original long URL if the feature is disabled or creation fails.
 */
export async function createShortLinkIfEnabled(
  supabase: SupabaseClient,
  options: CreateShortLinkOptions
): Promise<string> {
  const { longUrl, companyId, title, customAlias, createdByType = 'system', createdById } = options;

  // Check if feature is enabled
  const enabled = await isShortLinksEnabled(supabase, companyId);
  if (!enabled) {
    return longUrl;
  }

  try {
    // Generate unique short code
    let shortCode: string = '';
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      shortCode = generateShortCode(8);
      const { data: existing } = await supabase
        .from('short_links')
        .select('id')
        .eq('short_code', shortCode)
        .maybeSingle();

      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.warn('Failed to generate unique short code');
      return longUrl;
    }

    // Check custom alias uniqueness if provided
    let finalAlias = customAlias;
    if (customAlias) {
      const { data: existingAlias } = await supabase
        .from('short_links')
        .select('id')
        .eq('custom_alias', customAlias)
        .maybeSingle();

      if (existingAlias) {
        // Alias already exists, append random suffix
        finalAlias = `${customAlias}-${Date.now().toString(36).slice(-4)}`;
      }
    }

    // Insert the short link
    const { data: newLink, error: insertError } = await supabase
      .from('short_links')
      .insert({
        company_id: companyId,
        created_by_type: createdByType,
        created_by_id: createdById,
        long_url: longUrl,
        short_code: shortCode,
        custom_alias: finalAlias || null,
        title: title || null,
      } as any)
      .select()
      .single();

    if (insertError || !newLink) {
      console.error('Failed to create short link:', insertError);
      return longUrl;
    }

    // Get base URL and build short URL
    const baseUrl = await getCompanyBaseUrl(supabase, companyId);
    const code = finalAlias || shortCode;
    return `${baseUrl}/r/${code}`;
  } catch (err) {
    console.error('Error creating short link:', err);
    return longUrl;
  }
}

/**
 * Create a meaningful portal short link with customer name as alias.
 */
export async function createPortalShortLink(
  supabase: SupabaseClient,
  portalUrl: string,
  companyId: string,
  customerName?: string,
  projectNumber?: string | number
): Promise<string> {
  let alias: string | undefined;
  
  if (customerName) {
    const cleanName = customerName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);
    
    if (projectNumber) {
      alias = `${cleanName}-${projectNumber}`;
    } else {
      alias = `${cleanName}-${Date.now().toString(36).slice(-4)}`;
    }
  }

  return createShortLinkIfEnabled(supabase, {
    longUrl: portalUrl,
    companyId,
    title: customerName ? `Portal: ${customerName}` : 'Customer Portal',
    customAlias: alias,
    createdByType: 'system',
  });
}

/**
 * Create a meaningful salesperson calendar short link.
 */
export async function createSalespersonCalendarShortLink(
  supabase: SupabaseClient,
  calendarUrl: string,
  companyId: string,
  salespersonName?: string
): Promise<string> {
  let alias: string | undefined;
  
  if (salespersonName) {
    const cleanName = salespersonName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 25);
    alias = `cal-${cleanName}`;
  }

  return createShortLinkIfEnabled(supabase, {
    longUrl: calendarUrl,
    companyId,
    title: salespersonName ? `Calendar: ${salespersonName}` : 'Sales Calendar',
    customAlias: alias,
    createdByType: 'system',
  });
}
