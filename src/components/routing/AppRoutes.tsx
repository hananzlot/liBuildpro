import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Index";
import Auth from "@/pages/Auth";
import Production from "@/pages/Production";
import Analytics from "@/pages/Analytics";
import FinancialStatements from "@/pages/FinancialStatements";
import AuditLog from "@/pages/AuditLog";
import FollowUp from "@/pages/FollowUp";
import MagazineSales from "@/pages/MagazineSales";
import Estimates from "@/pages/Estimates";
import EstimateBuilder from "@/pages/EstimateBuilder";
import ProjectEditor from "@/pages/ProjectEditor";
import ProjectDetail from "@/pages/ProjectDetail";
import OpportunityDetail from "@/pages/OpportunityDetail";
import AppointmentDetail from "@/pages/AppointmentDetail";
import ExternalBrowser from "@/pages/ExternalBrowser";
import Documents from "@/pages/Documents";
import ClientPortal from "@/pages/ClientPortal";
import DocumentPortal from "@/pages/DocumentPortal";
import AdminSettings from "@/pages/AdminSettings";
import SalesPortal from "@/pages/SalesPortal";
import Opportunities from "@/pages/Opportunities";
import Appointments from "@/pages/Appointments";
import Calendar from "@/pages/Calendar";
import Contacts from "@/pages/Contacts";
import NotFound from "@/pages/NotFound";
import SalespersonCalendarPortal from "@/pages/SalespersonCalendarPortal";
import ShortLinkRedirect from "@/pages/ShortLinkRedirect";
import SuperAdminDashboard from "@/pages/super-admin/SuperAdminDashboard";
import SuperAdminTenants from "@/pages/super-admin/SuperAdminTenants";
import AppDefaultSettings from "@/pages/super-admin/AppDefaultSettings";
import PlatformAdmins from "@/pages/super-admin/PlatformAdmins";
import SubscriptionPlans from "@/pages/super-admin/SubscriptionPlans";
import PlatformEmailSettingsPage from "@/pages/super-admin/PlatformEmailSettings";
import BackupManagement from "@/pages/super-admin/BackupManagement";
import Onboarding from "@/pages/Onboarding";
import OutstandingAR from "@/pages/OutstandingAR";
import OutstandingAP from "@/pages/OutstandingAP";
import PendingDeposits from "@/pages/PendingDeposits";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import QuickBooksHelp from "@/pages/QuickBooksHelp";
import { ProtectedRoute, DefaultPageRedirect } from "./RouteGuards";

/**
 * Main application routes.
 * Detail views use URL params to control modal state,
 * making them stable across tab switches and page refreshes.
 */
export function AppRoutes() {
  return (
    <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<DefaultPageRedirect />} />
        
        {/* Dispatch Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="dashboard">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        
        {/* Sales portal - sales only */}
        <Route
          path="/sales-portal"
          element={
            <ProtectedRoute allowedRoles={['sales', 'admin']} requiredFeature="sales_portal">
              <SalesPortal />
            </ProtectedRoute>
          }
        />
        
        {/* Opportunities - list and detail routes */}
        <Route
          path="/opportunities"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Opportunities />
            </ProtectedRoute>
          }
        />
        <Route
          path="/opportunities/:opportunityId"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Opportunities />
            </ProtectedRoute>
          }
        />
        
        {/* Opportunity detail - full page route that opens in tabs */}
        <Route
          path="/opportunity/:id"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <OpportunityDetail />
            </ProtectedRoute>
          }
        />
        
        {/* Appointments - list and detail routes */}
        <Route
          path="/appointments"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Appointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointments/:appointmentId"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Appointments />
            </ProtectedRoute>
          }
        />
        
        {/* Appointment detail - full page route that opens in tabs */}
        <Route
          path="/appointment/:id"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <AppointmentDetail />
            </ProtectedRoute>
          }
        />
        
        {/* Calendar - list and detail routes */}
        <Route
          path="/calendar"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Calendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar/appointment/:appointmentId"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Calendar />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/follow-up"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <FollowUp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/follow-up/opportunity/:opportunityId"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <FollowUp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/follow-up/opportunity/:opportunityId/task/:taskGhlId"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <FollowUp />
            </ProtectedRoute>
          }
        />
        
        {/* Contacts - admin only */}
        <Route
          path="/contacts"
          element={
            <ProtectedRoute allowedRoles={['admin']} requiredFeature="ghl_integration">
              <Contacts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/:contactId"
          element={
            <ProtectedRoute allowedRoles={['admin']} requiredFeature="ghl_integration">
              <Contacts />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/magazine-sales"
          element={
            <ProtectedRoute allowedRoles={['admin', 'magazine']} requiredFeature="magazine_sales">
              <MagazineSales />
            </ProtectedRoute>
          }
        />
        
        {/* Production - list and detail routes */}
        <Route
          path="/production"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <Production />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production/:projectId"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <Production />
            </ProtectedRoute>
          }
        />
        
        {/* Project detail - full page route that opens in tabs */}
        <Route
          path="/project/:id"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <ProjectDetail />
            </ProtectedRoute>
          }
          />
        
        {/* Outstanding AR - accessible by production role or analytics permission */}
        <Route
          path="/outstanding-ar"
          element={
            <ProtectedRoute>
              <OutstandingAR />
            </ProtectedRoute>
          }
        />
        
        {/* Outstanding AP - accessible by production role or analytics permission */}
        <Route
          path="/outstanding-ap"
          element={
            <ProtectedRoute>
              <OutstandingAP />
            </ProtectedRoute>
          }
        />
        
        {/* Pending Deposits */}
        <Route
          path="/pending-deposits"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <PendingDeposits />
            </ProtectedRoute>
          }
        />
        
        {/* Financial Statements - P&L and Balance Sheet */}
        <Route
          path="/analytics/pnl"
          element={
            <ProtectedRoute requiredFeature="analytics">
              <FinancialStatements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/balance-sheet"
          element={
            <ProtectedRoute requiredFeature="analytics">
              <FinancialStatements />
            </ProtectedRoute>
          }
        />
        
        {/* Analytics - with per-tab routes */}
        <Route
          path="/analytics"
          element={
            <ProtectedRoute requiredFeature="analytics">
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/:tab"
          element={
            <ProtectedRoute requiredFeature="analytics">
              <Analytics />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <AuditLog />
            </ProtectedRoute>
          }
        />
        
        {/* Estimates - list and detail routes */}
        <Route
          path="/estimates"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="estimates">
              <Estimates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/estimates/:estimateId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="estimates">
              <Estimates />
            </ProtectedRoute>
          }
        />
        
        {/* Estimate builder - full page routes that open in tabs */}
        <Route
          path="/estimate/new"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="estimates">
              <EstimateBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/estimate/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="estimates">
              <EstimateBuilder />
            </ProtectedRoute>
          }
        />
        
        {/* Project editor - full page routes that open in tabs */}
        <Route
          path="/project/new"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <ProjectEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:id/edit"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <ProjectEditor />
            </ProtectedRoute>
          }
        />
        
        {/* Admin settings - admin only */}
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSettings />
            </ProtectedRoute>
          }
        />
        
        {/* Onboarding wizard - admin only */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        
        {/* Documents - list and detail routes */}
        <Route
          path="/documents"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="documents">
              <Documents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/:documentId"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="documents">
              <Documents />
            </ProtectedRoute>
          }
        />
        
        {/* Public client portal - no auth required */}
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/portal/:token" element={<ClientPortal />} />
        
        {/* Public document portal - no auth required */}
        <Route path="/document-portal" element={<DocumentPortal />} />
        
        {/* Public salesperson calendar portal - no auth required */}
        <Route path="/salesperson-calendar/:token" element={<SalespersonCalendarPortal />} />
        
        {/* Short link redirect - public */}
        <Route path="/r/:code" element={<ShortLinkRedirect />} />
        
        {/* Legal pages - public */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        
        {/* Help pages - public */}
        <Route path="/help/quickbooks" element={<QuickBooksHelp />} />
        
        {/* External browser - embedded web view */}
        <Route
          path="/browser"
          element={
            <ProtectedRoute>
              <ExternalBrowser />
            </ProtectedRoute>
          }
        />
        
        {/* Super Admin Portal Routes */}
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/tenants" element={<SuperAdminTenants />} />
        <Route path="/super-admin/app-settings" element={<AppDefaultSettings />} />
        <Route path="/super-admin/admins" element={<PlatformAdmins />} />
        <Route path="/super-admin/plans" element={<SubscriptionPlans />} />
        <Route path="/super-admin/email-settings" element={<PlatformEmailSettingsPage />} />
        <Route path="/super-admin/backups" element={<BackupManagement />} />
        
        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
  );
}
