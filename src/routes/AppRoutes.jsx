import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import ProtectedRoute from "../components/layout/ProtectedRoute";

const AdminPage = lazy(() => import("../pages/app/AdminPage"));
const DashboardPage = lazy(() => import("../pages/app/DashboardPage"));
const OrdersPage = lazy(() => import("../pages/app/OrdersPage"));
const ProfilePage = lazy(() => import("../pages/app/ProfilePage"));
const SupportPage = lazy(() => import("../pages/app/SupportPage"));
const WalletPage = lazy(() => import("../pages/app/WalletPage"));
const LoginPage = lazy(() => import("../pages/auth/LoginPage"));
const SignupPage = lazy(() => import("../pages/auth/SignupPage"));
const TradePage = lazy(() => import("../pages/trade/TradePage"));

function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <div className="page-loader-dot" />
      <div className="page-loader-dot" />
      <div className="page-loader-dot" />
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={withSuspense(<LoginPage />)} />
      <Route path="/signup" element={withSuspense(<SignupPage />)} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={withSuspense(<DashboardPage />)} />
        <Route path="wallet" element={withSuspense(<WalletPage />)} />
        <Route path="trade" element={withSuspense(<TradePage />)} />
        <Route path="sell" element={<Navigate to="/trade?tab=sell" replace />} />
        <Route path="buy" element={<Navigate to="/trade?tab=buy" replace />} />
        <Route path="orders" element={withSuspense(<OrdersPage />)} />
        <Route path="profile" element={withSuspense(<ProfilePage />)} />
        <Route path="support" element={withSuspense(<SupportPage />)} />
        <Route path="admin" element={withSuspense(<AdminPage />)} />
        <Route path="tmpesa-admin" element={withSuspense(<AdminPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
