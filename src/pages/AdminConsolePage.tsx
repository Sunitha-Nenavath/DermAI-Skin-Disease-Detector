import React, { useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { auditService, readLocalAuditLogs } from '../services/auditService';
import type { AuditLogEntry, UserProfile, UserRole } from '../types';
import { ShieldCheck, Users, ClipboardList, Filter, AlertCircle } from 'lucide-react';

export const AdminConsolePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (!auth.currentUser) {
        if (user) setUsersList([user]);
        setAuditLogs(readLocalAuditLogs());
        return;
      }

      const [userSnap, logSnap] = await Promise.all([
        getDocs(collection(db, 'users')).catch(() => null),
        getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100))).catch(() => null),
      ]);

      if (userSnap) {
        setUsersList(userSnap.docs.map((d) => d.data() as UserProfile));
      }
      if (logSnap) {
        setAuditLogs(logSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLogEntry)));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [user]);

  const handleRoleUpdate = async (targetUser: UserProfile, newRole: UserRole) => {
    if (!user || user.role !== 'admin') return;
    try {
      await setDoc(
        doc(db, 'users', targetUser.uid),
        { role: newRole, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      await auditService.log({
        action: 'role_change',
        user_id: user.uid,
        user_email: user.email,
        user_role: user.role,
        target_id: targetUser.uid,
        details: `Admin changed role for ${targetUser.email} from ${targetUser.role} to ${newRole}`,
      });
      setUsersList((prev) => prev.map((u) => (u.uid === targetUser.uid ? { ...u, role: newRole } : u)));
      showToast({
        title: 'User Role Updated',
        message: `${targetUser.email} assigned role ${newRole}.`,
        level: 'Informational',
      });
    } catch (err: any) {
      showToast({
        title: 'Role Update Error',
        message: err.message || 'Sign in with a verified Firebase Admin account to modify Firestore user roles.',
        level: 'Medium',
      });
    }
  };

  const filteredLogs = auditLogs.filter((l) => actionFilter === 'all' || l.action === actionFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A]">
            Administrator Governance &amp; Audit Console
          </h1>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            Admin Restricted
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Manage registered user roles in Firestore (`users/&#123;uid&#125;`) and inspect immutable compliance audit logs.
        </p>
      </div>

      {/* User Role Management */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0E9F8E]" />
            Registered Users ({usersList.length})
          </h2>
          <span className="text-xs text-slate-400">Firestore `users` collection</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading directory...</div>
        ) : usersList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <AlertCircle className="w-5 h-5 text-slate-300" />
            <span>No Firestore user records readable in current session (sign in with Admin Firebase credentials to manage live accounts).</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">UID</th>
                  <th className="px-4 py-3">Assigned Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">{u.displayName}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{u.uid}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleUpdate(u, e.target.value as UserRole)}
                        className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-xs font-semibold text-[#0B1F3A]"
                      >
                        <option value="patient">patient</option>
                        <option value="clinician">clinician</option>
                        <option value="researcher">researcher</option>
                        <option value="ml_engineer">ml_engineer</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Log Stream */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#0E9F8E]" />
            Immutable Audit Logs ({filteredLogs.length})
          </h2>

          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-xs font-semibold"
            >
              <option value="all">All Events</option>
              <option value="login">login</option>
              <option value="case_create">case_create</option>
              <option value="upload">upload</option>
              <option value="analysis">analysis</option>
              <option value="report_download">report_download</option>
              <option value="role_change">role_change</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No audit log entries match the filter or current Firebase Admin session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{log.user_email}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{log.user_role}</td>
                    <td className="px-4 py-3 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#0E9F8E] shrink-0" />
        <span className="font-semibold">Notice: AI-assisted analysis, not a standalone medical diagnosis.</span>
      </div>
    </div>
  );
};
