import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { Activity, LogOut, ChevronDown, Check } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationCenter } from './NotificationCenter';

export const Navbar: React.FC = () => {
  const { user, logout, switchDemoRole } = useAuth();
  const location = useLocation();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Case Registry', path: '/cases' },
    { label: 'New Case', path: '/cases/new' },
    { label: 'Model Registry', path: '/models' },
    { label: 'Evaluation', path: '/evaluation' },
    { label: 'Dataset', path: '/dataset' },
    { label: 'Settings & Legal', path: '/settings' },
  ];

  const roles: { role: UserRole; label: string; desc: string }[] = [
    { role: 'clinician', label: 'Clinician / Dermatologist', desc: 'Full cohort review & notes' },
    { role: 'patient', label: 'Patient / Self-Check', desc: 'Isolated personal cases' },
    { role: 'researcher', label: 'Medical Researcher', desc: 'Epidemiological trends' },
    { role: 'ml_engineer', label: 'Data Scientist / ML', desc: 'Pipelines & weights' },
    { role: 'admin', label: 'Administrator', desc: 'Security & audit logs' },
  ];

  const handleRoleSwitch = async (r: UserRole) => {
    setRoleMenuOpen(false);
    await switchDemoRole(r);
  };

  return (
    <header className="bg-[#0B1F3A] text-white sticky top-0 z-40 border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#0E9F8E] flex items-center justify-center text-white font-bold text-base shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#0E9F8E] transition-colors">
                DermAI
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-400 font-mono">
                M1 Core
              </span>
            </div>
          </Link>
        </div>

        {/* Zone 2: Navigation Links */}
        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Quick Role Switcher & Account */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Demo Role Switcher Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-colors"
                  title="Switch Demo Role"
                >
                  <span className="text-slate-400">Role:</span>
                  <span className="capitalize text-teal-300 font-semibold">{user.role}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {roleMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 animate-in fade-in slide-in-from-top-1"
                    onMouseLeave={() => setRoleMenuOpen(false)}
                  >
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Switch Role (Demo Accounts)
                    </div>
                    {roles.map((item) => (
                      <button
                        key={item.role}
                        onClick={() => handleRoleSwitch(item.role)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-start justify-between hover:bg-slate-50 transition-colors ${
                          user.role === item.role ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-[13px]">{item.label}</div>
                          <div className="text-[11px] text-slate-400">{item.desc}</div>
                        </div>
                        {user.role === item.role && <Check className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* In-app Notification Center */}
              <NotificationCenter />

              {/* In-app PWA install prompt */}
              <PWAInstallButton />

              {/* User display */}
              <div className="hidden sm:block text-right">
                <div className="text-xs font-medium text-white truncate max-w-[140px]">
                  {user.displayName || user.full_name || 'Clinical User'}
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{user.email}</div>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs font-semibold text-white hover:text-teal-300 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0E9F8E] rounded-md hover:bg-[#0B7C6E] transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
