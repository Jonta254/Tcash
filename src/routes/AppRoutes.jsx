import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import AdminPage from "../pages/app/AdminPage";
import DashboardPage from "../pages/app/DashboardPage";
import OrdersPage from "../pages/app/OrdersPage";
import ProfilePage from "../pages/app/ProfilePage";
import SupportPage from "../pages/app/SupportPage";
import WalletPage from "../pages/app/WalletPage";
import LoginPage from "../pages/auth/LoginPage";
import SignupPage from "../pages/auth/SignupPage";
import TradePage from "../pages/trade/TradePage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="trade" element={<TradePage />} />
        <Route path="sell" element={<Navigate to="/trade?tab=sell" replace />} />
        <Route path="buy" element={<Navigate to="/trade?tab=buy" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
