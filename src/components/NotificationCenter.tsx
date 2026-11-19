import React, { useState, useEffect } from 'react';
import { Bell, Check, X, ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import type { InAppNotification } from '../types';

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  const loadNotifications = async () => {
    if (!user) return;
    const list = await notificationService.getNotifications(user.uid);
    setNotifications(list);
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (id: string) => {
    if (!user) return;
    await notificationService.markAsRead(user.uid, id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'High':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-teal-100 text-teal-800 border-teal-300';
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition"
        title="Notification Center"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#0B1F3A]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 text-slate-800 z-50 animate-in fade-in slide-in-from-top-1">
          <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[#0B1F3A]">Clinical Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No new notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 hover:bg-slate-50 transition text-xs space-y-1.5 ${
                    !n.read ? 'bg-teal-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0E9F8E] shrink-0" />
                      )}
                      <span>{n.title}</span>
                    </div>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${getLevelBadge(
                        n.level
                      )}`}
                    >
                      {n.level}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                    <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {!n.read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-[#0E9F8E] hover:underline font-semibold"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 pt-2.5 border-t border-slate-100 text-[10px] text-center text-slate-400">
            AI-assisted findings only · Not a medical diagnosis
          </div>
        </div>
      )}
    </div>
  );
};
