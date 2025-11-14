import React, { lazy, Suspense } from "react";
import { Routes, Route, Outlet, BrowserRouter } from "react-router-dom";
import Header from "./components/Header";
import ToastProvider from "./components/ToastProvider";
// FIX: CampaignPublicPage is not a default export, so it should be imported with curly braces.
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import Spinner from "./components/Spinner";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ClientDetails = lazy(() => import("./pages/ClientDetails"));
const CampaignEdit = lazy(() => import("./pages/CampaignEdit"));
const CampaignPublicPage = lazy(() => import("./pages/CampaignPublicPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ParticipationTicketPage = lazy(
  () => import("./pages/ParticipationTicketPage"),
);
const MonitorPage = lazy(() => import("./pages/MonitorPage"));
const EventParticipationPage = lazy(
  () => import("./pages/EventParticipationPage"),
);
const LineAuthCallback = lazy(() => import("./pages/LineAuthCallback"));

const AdminLayout: React.FC = () => (
  <div className="min-h-screen bg-slate-50 text-slate-800">
    <Header />
    <main className="p-4 sm:p-6 lg:p-8">
      <Outlet />
    </main>
  </div>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastProvider>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Spinner />
              </div>
            }
          >
            <Routes>
              {/* Blank Home Page */}
              <Route path="/" element={<div />} />

              {/* Public Routes */}
              <Route
                path="/campaign/:campaignId"
                element={<CampaignPublicPage />}
              />
              <Route
                path="/ticket/:campaignId"
                element={<ParticipationTicketPage />}
              />
              <Route path="/monitor/:campaignId" element={<MonitorPage />} />
              <Route
                path="/event/:campaignId"
                element={<EventParticipationPage />}
              />
              <Route
                path="/auth/line/callback"
                element={<LineAuthCallback />}
              />
              <Route path="/admin/login" element={<LoginPage />} />
              <Route path="/admin/registration" element={<RegisterPage />} />

              {/* Protected Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="clients/:clientId" element={<ClientDetails />} />
                  <Route
                    path="clients/:clientId/campaigns/:campaignId"
                    element={<CampaignEdit />}
                  />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
