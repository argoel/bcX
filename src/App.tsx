import { Routes, Route, Navigate } from "react-router-dom";
import AppProvider from "./components/AppProvider";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import CompanyBank from "./pages/CompanyBank";
import Funding from "./pages/Funding";
import Payroll from "./pages/Payroll";
import RootActivity from "./pages/RootActivity";
import Login from "./pages/Login";

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/company-bank" element={<CompanyBank />} />
          <Route path="/funding" element={<Funding />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/root-activity" element={<RootActivity />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  );
}
