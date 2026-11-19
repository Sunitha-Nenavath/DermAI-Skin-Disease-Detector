import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MlStatusProvider } from './context/MlStatusContext';
import { ToastProvider } from './context/ToastContext';
import type { UserRole } from './types';
import { Navbar } from './components/Navbar';
import { ClinicalBanner, ClinicalFooter } from './components/ClinicalNotice';
import { OfflineIndicator } from './components/OfflineIndicator';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CasesListPage } from './pages/CasesListPage';
import { NewCasePage } from './pages/NewCasePage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { EdaViewerPage } from './pages/EdaViewerPage';
import { PresentationPage } from './pages/PresentationPage';
import { ModelManagementPage } from './pages/ModelManagementPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { SettingsHelpLegalPage } from './pages/SettingsHelpLegalPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminConsolePage } from './pages/AdminConsolePage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-xs text-slate-400">
        Verifying clinical session credentials...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RoleGuard: React.FC<{ allowed: UserRole[]; children: React.ReactNode }> = ({
  allowed,
  children,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-xs text-slate-400">
        Verifying role permissions...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowed.includes(user.role)) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-white rounded-2xl border border-rose-200 text-center space-y-2">
        <h2 className="text-base font-bold text-[#0B1F3A]">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Your active role (<span className="font-mono font-bold">{user.role}</span>) does not have permission to open this console.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MlStatusProvider>
          <ToastProvider>
            <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0B1F3A]">
              {/* Ubiquitous clinical notice & dynamic ML mode banner */}
              <ClinicalBanner />

              {/* Navigation bar */}
              <Navbar />

              {/* Main viewport */}
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cases"
                    element={
                      <ProtectedRoute>
                        <CasesListPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cases/new"
                    element={
                      <ProtectedRoute>
                        <NewCasePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cases/:id"
                    element={
                      <ProtectedRoute>
                        <CaseDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dataset"
                    element={
                      <ProtectedRoute>
                        <EdaViewerPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/presentation"
                    element={
                      <ProtectedRoute>
                        <PresentationPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/models"
                    element={
                      <ProtectedRoute>
                        <ModelManagementPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/evaluation"
                    element={
                      <ProtectedRoute>
                        <EvaluationPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <RoleGuard allowed={['admin']}>
                        <AdminConsolePage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <SettingsHelpLegalPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>

              {/* Ubiquitous clinical footer */}
              <ClinicalFooter />

              {/* PWA offline connectivity indicator */}
              <OfflineIndicator />
            </div>
          </ToastProvider>
        </MlStatusProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
