import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Strip HTML tags from text
export const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

// Custom field IDs from GHL
export const CUSTOM_FIELD_IDS = {
  ADDRESS: "b7oTVsUQrLgZt84bHpCn",
  SCOPE_OF_WORK: "KwQRtJT0aMSHnq3mwR68",
  NOTES: "588ddQgiGEg3AWtTQB2i",
};

// Extract a custom field value from contact custom_fields array
export const extractCustomField = (customFields: unknown, fieldId: string): string | null => {
  if (!customFields) return null;
  
  let fieldsArray: Array<{ id: string; value: string }> | null = null;
  
  if (Array.isArray(customFields)) {
    fieldsArray = customFields as Array<{ id: string; value: string }>;
  }
  
  if (!fieldsArray || !Array.isArray(fieldsArray)) return null;
  
  const field = fieldsArray.find((f: { id: string; value: string }) => f?.id === fieldId);
  return field?.value || null;
};

// Get address from contact, with optional fallback to appointment address
export const getAddressFromContact = (
  contact: { custom_fields?: unknown } | null | undefined,
  appointments?: Array<{ contact_id?: string | null; address?: string | null }>,
  contactId?: string | null
): string | null => {
  // First try contact custom_fields
  const contactAddress = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  if (contactAddress) return contactAddress;
  
  // Fall back to appointment address if provided
  if (appointments && contactId) {
    const appointmentAddress = appointments.find(
      a => a.contact_id === contactId && a.address
    )?.address;
    if (appointmentAddress) return appointmentAddress;
  }
  
  return null;
};

// Format currency with zero shown as dash
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Format currency with decimals only if they exist (e.g., $1,234 or $1,234.56)
export const formatCurrencyWithDecimals = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return "-";
  const hasDecimals = value % 1 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
};

// Format currency compactly (e.g., $1.2M, $500K)
export const formatCompactCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return "-";
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

// Helper to find contact using UUID with fallback to GHL ID
// Supports the Supabase-as-source-of-truth architecture where UUID is preferred
export function findContactByIdOrGhlId<T extends { id: string; ghl_id?: string | null }>(
  contacts: T[] | undefined,
  contactUuid: string | null | undefined,
  contactGhlId: string | null | undefined
): T | undefined {
  if (!contacts) return undefined;
  if (contactUuid) {
    const found = contacts.find(c => c.id === contactUuid);
    if (found) return found;
  }
  if (contactGhlId) {
    return contacts.find(c => c.ghl_id === contactGhlId);
  }
  return undefined;
}

// Helper to find opportunity using UUID with fallback to GHL ID
export function findOpportunityByIdOrGhlId<T extends { id: string; ghl_id?: string | null }>(
  opportunities: T[] | undefined,
  opportunityUuid: string | null | undefined,
  opportunityGhlId: string | null | undefined
): T | undefined {
  if (!opportunities) return undefined;
  if (opportunityUuid) {
    const found = opportunities.find(o => o.id === opportunityUuid);
    if (found) return found;
  }
  if (opportunityGhlId) {
    return opportunities.find(o => o.ghl_id === opportunityGhlId);
  }
  return undefined;
}

// Helper to find GHL user using UUID with fallback to GHL ID
export function findUserByIdOrGhlId<T extends { id?: string; ghl_id: string }>(
  users: T[] | undefined,
  userUuid: string | null | undefined,
  userGhlId: string | null | undefined
): T | undefined {
  if (!users) return undefined;
  if (userUuid) {
    const found = users.find(u => u.id === userUuid);
    if (found) return found;
  }
  if (userGhlId) {
    return users.find(u => u.ghl_id === userGhlId);
  }
  return undefined;
}
