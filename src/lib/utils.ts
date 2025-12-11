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
