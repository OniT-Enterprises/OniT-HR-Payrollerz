import { createBrowserRouter, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import StaffDashboard from "@/pages/staff/StaffDashboard";

// For now, we'll use the main Dashboard as a catch-all
// but we can expand this to include specific module dashboards
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />,
  },
  {
    path: "/staff/dashboard",
    element: <StaffDashboard />,
  },
  // Redirect old staff paths to new dashboard structure
  {
    path: "/staff",
    element: <Navigate to="/staff/dashboard" replace />,
  },
  // Catch-all for other routes - redirect to main dashboard for now
  {
    path: "*",
    element: <Dashboard />,
  },
]);
