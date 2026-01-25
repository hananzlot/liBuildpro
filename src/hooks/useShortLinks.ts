import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CreateShortLinkParams {
  longUrl: string;
  title?: string;
  customAlias?: string;
  expiresAt?: string;
  maxClicks?: number;
}

interface ShortLinkResult {
  shortUrl: string;
  shortCode: string;
  customAlias?: string;
}

/**
 * Hook to create short links when the feature is enabled for the company.
 * If the feature is disabled, returns the original long URL.
 */
export function useShortLinks() {
  const { canUseFeature } = useAuth();
  
  const isShortLinksEnabled = canUseFeature('short_links');

  /**
   * Creates a short link for the given URL if the feature is enabled.
   * Returns the original URL if the feature is disabled or if creation fails.
   */
  const createShortLink = useCallback(async ({
    longUrl,
    title,
    customAlias,
    expiresAt,
    maxClicks,
  }: CreateShortLinkParams): Promise<string> => {
    if (!isShortLinksEnabled) {
      return longUrl;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-short-link', {
        body: {
          long_url: longUrl,
          title,
          custom_alias: customAlias,
          expires_at: expiresAt,
          max_clicks: maxClicks,
        },
      });

      if (error || !data?.short_url) {
        console.warn('Failed to create short link, using long URL:', error);
        return longUrl;
      }

      return data.short_url;
    } catch (err) {
      console.warn('Error creating short link, using long URL:', err);
      return longUrl;
    }
  }, [isShortLinksEnabled]);

  /**
   * Generates a meaningful short link for customer portal.
   * Uses the customer name as custom alias if possible.
   */
  const createPortalShortLink = useCallback(async (
    portalUrl: string,
    customerName?: string,
    projectNumber?: string | number
  ): Promise<string> => {
    if (!isShortLinksEnabled) {
      return portalUrl;
    }

    // Generate a meaningful alias from customer name and project number
    let alias: string | undefined;
    if (customerName) {
      // Clean the name: lowercase, replace spaces with dashes, remove special chars
      const cleanName = customerName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 20);
      
      if (projectNumber) {
        alias = `${cleanName}-${projectNumber}`;
      } else {
        // Add a short random suffix to avoid collisions
        alias = `${cleanName}-${Date.now().toString(36).slice(-4)}`;
      }
    }

    return createShortLink({
      longUrl: portalUrl,
      title: customerName ? `Portal: ${customerName}` : 'Customer Portal',
      customAlias: alias,
    });
  }, [isShortLinksEnabled, createShortLink]);

  /**
   * Generates a meaningful short link for salesperson calendar portal.
   */
  const createSalespersonCalendarShortLink = useCallback(async (
    calendarUrl: string,
    salespersonName?: string
  ): Promise<string> => {
    if (!isShortLinksEnabled) {
      return calendarUrl;
    }

    // Generate a meaningful alias from salesperson name
    let alias: string | undefined;
    if (salespersonName) {
      const cleanName = salespersonName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 25);
      alias = `cal-${cleanName}`;
    }

    return createShortLink({
      longUrl: calendarUrl,
      title: salespersonName ? `Calendar: ${salespersonName}` : 'Sales Calendar',
      customAlias: alias,
    });
  }, [isShortLinksEnabled, createShortLink]);

  return {
    isShortLinksEnabled,
    createShortLink,
    createPortalShortLink,
    createSalespersonCalendarShortLink,
  };
}
