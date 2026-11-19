import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { Activity, LogOut, ChevronDown, Check, Menu, X, User as UserIcon } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationCenter } from './NotificationCenter';

export const Navbar: React.FC = () => {
  const { user, firebaseUser, logout, switchDemoRole } = useAuth();
  const location = useLocation();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const canSwitchRolePerspective =
    !firebaseUser ||
    user?.role === 'admin' ||
    firebaseUser.email?.toLowerCase() === 'sunithanenavath566@gmail.com';

  const navLinks = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Cases', path: '/cases' },
    { label: 'New Case', path: '/cases/new' },
    ...(user?.role === 'ml_engineer' || user?.role === 'admin' || user?.role === 'researcher' || user?.role === 'clinician'
      ? [
          { label: 'Models', path: '/models' },
          { label: 'Evaluation', path: '/evaluation' },
        ]
      : []),
    { label: 'Dataset', path: '/dataset' },
    ...(user?.role === 'admin' ? [{ label: 'Admin', path: '/admin' }] : []),
    { label: 'Settings', path: '/settings' },
  ];

  const roles: { role: UserRole; label: string; desc: string }[] = [
    { role: 'clinician', label: 'Clinician / Dermatologist', desc: 'Full cohort review & notes' },
    { role: 'patient', label: 'Patient / Self-Check', desc: 'Isolated personal cases' },
    { role: 'researcher', label: 'Medical Researcher', desc: 'De-identified epidemiology' },
    { role: 'ml_engineer', label: 'Data Scientist / ML', desc: 'Models, risk map & evals' },
    { role: 'admin', label: 'Administrator', desc: 'Users, audit logs & seed' },
  ];

  const handleRoleSwitch = async (r: UserRole) => {
    setRoleMenuOpen(false);
    await switchDemoRole(r);
  };

  return (
    <header className="bg-[#0B1F3A] text-white sticky top-0 z-40 border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#0E9F8E] flex items-center justify-center text-white font-bold text-base shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#0E9F8E] transition-colors">
                DermAI
              </span>
              <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-teal-400 font-mono">
                Screening
              </span>
            </div>
          </Link>
        </div>

        {/* Zone 2: Navigation Links */}
        {user && (
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-2.5 py-1.5 text-xs xl:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
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
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <div className="flex items-center gap-2.5">
              {/* Role Switcher Dropdown (Demo Sandbox or Admin only) */}
              <div className="relative">
                {canSwitchRolePerspective ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-colors"
                      title="Switch Active Role Perspective"
                    >
                      <span className="hidden sm:inline text-slate-400">Role:</span>
                      <span className="capitalize text-teal-300 font-semibold">{user.role.replace('_', ' ')}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {roleMenuOpen && (
                      <div
                        className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50"
                        onMouseLeave={() => setRoleMenuOpen(false)}
                      >
                        <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Switch Role Perspective
                        </div>
                        {roles.map((item) => (
                          <button
                            key={item.role}
                            type="button"
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
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-white/10 text-slate-200 border border-white/10">
                    <span className="hidden sm:inline text-slate-400">Role:</span>
                    <span className="capitalize text-teal-300 font-semibold">{user.role.replace('_', ' ')}</span>
                  </div>
                )}
              </div>

              {/* In-app Notification Center */}
              <NotificationCenter />

              {/* In-app PWA install prompt */}
              <PWAInstallButton />

              {/* Profile Link */}
              <Link
                to="/profile"
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition"
                title="View Profile & Session Settings"
              >
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-teal-300">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-medium text-white truncate max-w-[120px]">
                    {user.displayName || user.full_name || 'Clinical User'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user.email}</div>
                </div>
              </Link>

              {/* Logout */}
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
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

      {/* Mobile Navigation Drawer */}
      {user && mobileMenuOpen && (
        <nav className="lg:hidden border-t border-slate-800 bg-[#0d2544] px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-xs font-semibold ${
                  isActive ? 'bg-[#0E9F8E] text-white' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            to="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            Profile &amp; Security
          </Link>
        </nav>
      )}
    </header>
  );
};
