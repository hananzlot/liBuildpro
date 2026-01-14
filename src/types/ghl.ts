export interface GHLContact {
  id: string;
  locationId: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  dateAdded?: string;
  dateUpdated?: string;
  assignedTo?: string;
  customFields?: Record<string, any>[];
  attributions?: Attribution[];
}

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}

export interface GHLContactsResponse {
  contacts: GHLContact[];
  meta?: {
    total?: number;
    startAfterId?: string;
    startAfter?: number;
  };
}

export interface LeadsBySource {
  source: string;
  count: number;
}

export interface SalesRepPerformance {
  assignedTo: string;
  uniqueAppointments: number;
  wonOpportunities: number;
  totalOpportunities: number;
  wonValue: number;
  conversionRate: number;
  source?: 'appointments' | 'won_at';  // identifies data source
}

export interface DashboardMetrics {
  totalLeads: number;
  leadsThisMonth: number;
  leadsBySource: LeadsBySource[];
  salesRepPerformance: SalesRepPerformance[];
  recentLeads: GHLContact[];
  appointmentsShowedInDateRange?: number;
  appointmentsShowedInDateRangeList?: any[];
}
