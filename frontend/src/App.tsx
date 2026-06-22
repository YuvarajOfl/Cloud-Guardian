import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardOverview } from './components/DashboardOverview';
import { TerraformFiles } from './components/TerraformFiles';
import { InfrastructureAnalysis } from './components/InfrastructureAnalysis';
import { AIAdvisor } from './components/AIAdvisor';
import { Reports } from './components/Reports';
import { ProfilePage } from './components/ProfilePage';
import { SettingsPage } from './components/SettingsPage';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminUsers } from './components/AdminUsers';
import { AdminUserDetail } from './components/AdminUserDetail';
import { AdminLogs } from './components/AdminLogs';
import { AdminSecurity } from './components/AdminSecurity';


function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-mono tracking-widest uppercase">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  React.useEffect(() => {
    const handleThemeChange = () => {
      const storedTheme = localStorage.getItem('cg_theme') || 'dark';
      const root = document.documentElement;
      
      if (storedTheme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else if (storedTheme === 'dark') {
        root.classList.remove('light');
        root.classList.add('dark');
      } else {
        // system theme
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemIsDark) {
          root.classList.remove('light');
          root.classList.add('dark');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
    };

    handleThemeChange();

    window.addEventListener('storage', handleThemeChange);
    window.addEventListener('theme-change', handleThemeChange);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (localStorage.getItem('cg_theme') === 'system') {
        handleThemeChange();
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      window.removeEventListener('storage', handleThemeChange);
      window.removeEventListener('theme-change', handleThemeChange);
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} 
      />
      <Route 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        } 
      >
        <Route path="/dashboard" element={<DashboardOverview />} />
        <Route path="/dashboard/files" element={<TerraformFiles />} />
        <Route path="/dashboard/analysis" element={<InfrastructureAnalysis />} />
        <Route path="/dashboard/ai" element={<AIAdvisor />} />
        <Route path="/dashboard/reports" element={<Reports />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Admin Section */}
        <Route 
          element={
            <ProtectedRoute requiredRole="admin">
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/user/:id" element={<AdminUserDetail />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
        </Route>
      </Route>
      <Route 
        path="*" 
        element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
      />
    </Routes>
  );
}

