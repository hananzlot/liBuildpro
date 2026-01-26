import { Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Index";
import Auth from "@/pages/Auth";
import Production from "@/pages/Production";
import AuditLog from "@/pages/AuditLog";
import FollowUp from "@/pages/FollowUp";
import MagazineSales from "@/pages/MagazineSales";
import Estimates from "@/pages/Estimates";
import Documents from "@/pages/Documents";
import ClientPortal from "@/pages/ClientPortal";
import DocumentPortal from "@/pages/DocumentPortal";
import AdminSettings from "@/pages/AdminSettings";
import SalesPortal from "@/pages/SalesPortal";
import Opportunities from "@/pages/Opportunities";
import Appointments from "@/pages/Appointments";
import Calendar from "@/pages/Calendar";
import NotFound from "@/pages/NotFound";
import SalespersonCalendarPortal from "@/pages/SalespersonCalendarPortal";
import ShortLinkRedirect from "@/pages/ShortLinkRedirect";
import SuperAdminDashboard from "@/pages/super-admin/SuperAdminDashboard";
import SuperAdminTenants from "@/pages/super-admin/SuperAdminTenants";
import AppDefaultSettings from "@/pages/super-admin/AppDefaultSettings";
import PlatformAdmins from "@/pages/super-admin/PlatformAdmins";
import SubscriptionPlans from "@/pages/super-admin/SubscriptionPlans";
import PlatformEmailSettingsPage from "@/pages/super-admin/PlatformEmailSettings";
import { ProtectedRoute, DefaultPageRedirect } from "./RouteGuards";

/**
 * Main application routes.
 * Calendar detail views use URL params to control modal state,
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
        
        <Route
          path="/opportunities"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Opportunities />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/appointments"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Appointments />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/calendar"
          element={
            <ProtectedRoute blockSalesOnly requiredFeature="ghl_integration">
              <Calendar />
            </ProtectedRoute>
          }
        />
        
        {/* Calendar appointment detail - full page fallback when no background location */}
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
          path="/magazine-sales"
          element={
            <ProtectedRoute allowedRoles={['admin', 'magazine']} requiredFeature="magazine_sales">
              <MagazineSales />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/production"
          element={
            <ProtectedRoute requiredRole="production" requiredFeature="production">
              <Production />
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
        
        <Route
          path="/estimates"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="estimates">
              <Estimates />
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
        
        {/* Documents - admin and contract_manager */}
        <Route
          path="/documents"
          element={
            <ProtectedRoute allowedRoles={['admin', 'contract_manager']} requiredFeature="documents">
              <Documents />
            </ProtectedRoute>
          }
        />
        
        {/* Public client portal - no auth required */}
        <Route path="/portal" element={<ClientPortal />} />
        
        {/* Public document portal - no auth required */}
        <Route path="/document-portal" element={<DocumentPortal />} />
        
        {/* Public salesperson calendar portal - no auth required */}
        <Route path="/salesperson-calendar/:token" element={<SalespersonCalendarPortal />} />
        
        {/* Short link redirect - public */}
        <Route path="/r/:code" element={<ShortLinkRedirect />} />
        
        {/* Super Admin Portal Routes */}
        <Route path="/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/super-admin/tenants" element={<SuperAdminTenants />} />
        <Route path="/super-admin/app-settings" element={<AppDefaultSettings />} />
        <Route path="/super-admin/admins" element={<PlatformAdmins />} />
        <Route path="/super-admin/plans" element={<SubscriptionPlans />} />
        <Route path="/super-admin/email-settings" element={<PlatformEmailSettingsPage />} />
        
        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
  );
}
