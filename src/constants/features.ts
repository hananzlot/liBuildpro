// Available features that can be toggled per plan or per company
export const AVAILABLE_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', category: 'Core' },
  { key: 'sales_portal', label: 'Sales Portal', category: 'Sales' },
  { key: 'ghl_integration', label: 'GHL Integration', category: 'Integrations' },
  { key: 'production', label: 'Production Management', category: 'Operations' },
  { key: 'estimates', label: 'Estimates & Proposals', category: 'Sales' },
  { key: 'documents', label: 'Document Signing', category: 'Documents' },
  { key: 'magazine_sales', label: 'Magazine Sales', category: 'Sales' },
  { key: 'client_portal', label: 'Client Portal', category: 'Client' },
  { key: 'analytics', label: 'Advanced Analytics', category: 'Analytics' },
  { key: 'multi_location', label: 'Multi-Location', category: 'Advanced' },
  { key: 'short_links', label: 'Short Links', category: 'Advanced' },
] as const;

export type FeatureKey = typeof AVAILABLE_FEATURES[number]['key'];
