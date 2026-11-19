import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { User, KeyRound, ShieldCheck, CheckCircle2, LogOut, Lock } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, authProviderType, resetPassword, changePassword, updateDisplayName, logout } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  if (!user) return null;

  const sessionLabel =
    authProviderType === 'firebase'
      ? 'Firebase Authenticated Session'
      : authProviderType === 'server'
        ? 'DermAI Email & Password Account'
        : 'Offline Demo Sandbox Session';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDisplayName(displayName);
      showToast({
        title: 'Profile Updated',
        message: 'Your clinical display profile has been saved.',
        level: 'Informational',
      });
    } catch (err: any) {
      showToast({
        title: 'Update Warning',
        message: err.message || 'Could not update profile.',
        level: 'Low',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const msg = await resetPassword(user.email);
      showToast({
        title: 'Password Reset Notice',
        message: typeof msg === 'string' ? msg : `Reset link dispatched to ${user.email}.`,
        level: 'Informational',
      });
    } catch (err: any) {
      showToast({
        title: 'Password Reset Notice',
        message: err.message || 'Could not initiate password reset.',
        level: 'Low',
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast({
        title: 'Weak Password',
        message: 'New password must be at least 8 characters.',
        level: 'Low',
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast({
        title: 'Mismatch',
        message: 'New password and confirmation do not match.',
        level: 'Low',
      });
      return;
    }
    setUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast({
        title: 'Password Updated',
        message: 'Your account password has been changed successfully.',
        level: 'Informational',
      });
    } catch (err: any) {
      showToast({
        title: 'Password Change Failed',
        message: err.message || 'Please check your current password.',
        level: 'Low',
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">User Profile &amp; Session Security</h1>
        <p className="text-xs text-slate-500 mt-1">Manage clinical identity metadata, role permissions, and account credentials.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-[#0B1F3A] text-teal-400 flex items-center justify-center">
            <User className="w-7 h-7" />
          </div>
          <div>
            <div className="text-base font-bold text-[#0B1F3A]">{user.displayName}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#0E9F8E] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Role: {user.role.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0E9F8E]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-slate-400 text-[10px] uppercase font-bold">User UID</div>
              <div className="font-mono text-slate-800 mt-0.5 truncate">{user.uid}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Session Auth Type</div>
              <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E9F8E]" />
                <span>{sessionLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {authProviderType === 'firebase' && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Send Password Reset</span>
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#0E9F8E] hover:bg-[#0c8274] text-white font-semibold"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {authProviderType === 'server' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-[#0E9F8E]" />
            <h2 className="text-sm font-bold text-[#0B1F3A]">Update Account Password</h2>
          </div>

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0E9F8E]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0E9F8E]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Repeat new password"
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0E9F8E]"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={updatingPassword}
                className="px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 text-white font-semibold disabled:opacity-50"
              >
                {updatingPassword ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
