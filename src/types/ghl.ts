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
  userGhlId: string | null;          // the raw ID used in assigned_to / assigned_user_id
  uniqueAppointments: number;
  wonOpportunities: number;          // wins from appointments in range
  wonOpportunitiesFromWonAt: number; // additional wins from won_at date
  totalOpportunities: number;
  wonValue: number;                  // value from appointments in range
  wonValueFromWonAt: number;         // additional value from won_at date
  conversionRate: number;
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
