import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import { Activity, ShieldCheck, Stethoscope, User, Database, Cpu, Lock } from 'lucide-react';
import type { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('clinician@dermai.local');
  const [password, setPassword] = useState('ClinicianDoctor123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: UserRole) => {
    const creds = DEMO_CREDENTIALS[role];
    if (creds) {
      setEmail(creds.email);
      setPassword(creds.pass);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-[#0B1F3A] flex items-center justify-center text-teal-400 shadow-md">
            <Activity className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#0B1F3A]">
          DermAI Clinical Portal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Skin Disease Detection & Screening Platform · Milestone 1
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50/50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-[#0E9F8E] hover:bg-[#0B7C6E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to DermAI'}
            </button>
          </form>

          {/* Quick Demo Account Selector */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              One-Click Demo Account Autofill:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill('clinician')}
                className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
              >
                <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-800">Clinician</div>
                  <div className="text-[10px] text-slate-400">Dr. Sarah Chen</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('patient')}
                className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
              >
                <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-800">Patient</div>
                  <div className="text-[10px] text-slate-400">John Doe</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('ml_engineer')}
                className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-800">ML Engineer</div>
                  <div className="text-[10px] text-slate-400">Pipeline & Tests</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-800">Admin</div>
                  <div className="text-[10px] text-slate-400">Audit & Security</div>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-xs text-slate-500">Need a new test account? </span>
            <Link to="/register" className="text-xs font-semibold text-[#0E9F8E] hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
