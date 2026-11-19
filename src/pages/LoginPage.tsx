import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, formatFirebaseAuthError } from '../context/AuthContext';
import {
  Activity,
  ShieldCheck,
  Stethoscope,
  User,
  Cpu,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  UserPlus,
  LogIn,
} from 'lucide-react';
import type { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, resetPassword, switchDemoRole } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (nextMode: 'signin' | 'register') => {
    setMode(nextMode);
    setError(null);
    setInfoMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setError('Please create a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, fullName.trim(), role);
      navigate('/dashboard');
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setInfoMessage(null);
    if (!email.trim()) {
      setError('Enter your email address first to receive a password reset link.');
      return;
    }
    try {
      const msg = await resetPassword(email.trim());
      setInfoMessage(
        typeof msg === 'string'
          ? msg
          : `Password reset link sent to ${email.trim()}. Check your inbox.`
      );
    } catch (err: any) {
      setError(formatFirebaseAuthError(err));
    }
  };

  const handleEnterDemoSandbox = async (demoRole: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      await switchDemoRole(demoRole);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center py-10 sm:px-6 lg:px-8 bg-slate-50">
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
          AI-Assisted Skin Disease Screening &amp; Clinical Decision Support
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-6 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-8">
          {/* Mode Switcher: Sign In vs Create Account */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => switchMode('signin')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'signin'
                  ? 'bg-white text-[#0B1F3A] shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-white text-[#0B1F3A] shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          {mode === 'signin' ? (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label htmlFor="signin-email" className="block text-xs font-semibold text-slate-700">
                  Email Address
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="signin-password" className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="text-[11px] font-semibold text-[#0E9F8E] hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Forgot Password?</span>
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    id="signin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-[#0E9F8E] hover:bg-[#0B7C6E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleRegister}>
              <div>
                <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700">
                  Your Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
                />
              </div>

              <div>
                <label htmlFor="reg-role" className="block text-xs font-semibold text-slate-700">
                  Account Role
                </label>
                <select
                  id="reg-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="mt-1 block w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
                >
                  <option value="patient">Patient / General User</option>
                  <option value="clinician">Clinician / Dermatologist</option>
                  <option value="researcher">Medical Researcher</option>
                  <option value="ml_engineer">Data Scientist / ML Engineer</option>
                </select>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700">
                  Create Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && password.length < 8 && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Password must be at least 8 characters ({password.length}/8).
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm" className="block text-xs font-semibold text-slate-700">
                  Confirm Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="reg-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0E9F8E] focus:border-[#0E9F8E] bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="mt-1 text-[11px] text-rose-600">Passwords do not match.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-[#0E9F8E] hover:bg-[#0B7C6E] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[11px]">
              <span className="px-2 bg-white text-slate-400 uppercase tracking-wider">Or</span>
            </div>
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Optional Offline Demo Sandbox Drawer (Collapsed by default) */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSandbox(!showSandbox)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
            >
              <span>Offline Demo Sandbox (No Account Required)</span>
              {showSandbox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showSandbox && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleEnterDemoSandbox('clinician')}
                    className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
                  >
                    <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-slate-800">Clinician</div>
                      <div className="text-[10px] text-slate-400">Local Preview</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEnterDemoSandbox('patient')}
                    className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-slate-800">Patient</div>
                      <div className="text-[10px] text-slate-400">Local Preview</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEnterDemoSandbox('ml_engineer')}
                    className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
                  >
                    <Cpu className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-slate-800">ML Engineer</div>
                      <div className="text-[10px] text-slate-400">Local Preview</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEnterDemoSandbox('admin')}
                    className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-slate-800">Admin</div>
                      <div className="text-[10px] text-slate-400">Local Preview</div>
                    </div>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Local preview stores data only in your browser. Create an account or use Google Sign-In for Cloud Firestore persistence.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
