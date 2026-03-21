import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { Bell, Trash2, CheckCircle2, AlertCircle, Info, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationItem {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: 'admin_note' | 'system';
  system_type?: string;
}

export default function Notifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fetchAllNotifications = async () => {
    if (!user) return;
    try {
      // 1. Fetch Admin Notes
      const { data: adminNotes, error: adminError } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('user_id', user.id);

      // 2. Fetch System Notifications
      const { data: systemNotes, error: systemError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id);

      if (adminError) throw adminError;
      if (systemError) throw systemError;

      // Combine and sort
      const combined: NotificationItem[] = [
        ...(adminNotes || []).map(n => ({
          id: n.id,
          message: n.message,
          is_read: n.is_read,
          created_at: n.created_at,
          type: 'admin_note' as const
        })),
        ...(systemNotes || []).map(n => ({
          id: n.id,
          message: n.message,
          is_read: n.read,
          created_at: n.created_at,
          type: 'system' as const,
          system_type: n.type
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(combined);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllNotifications();

    const adminSub = supabase
      .channel('public:admin_notes_all')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'admin_notes',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchAllNotifications();
      })
      .subscribe();

    const systemSub = supabase
      .channel('public:notifications_all')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, () => {
        fetchAllNotifications();
      })
      .subscribe();

    return () => {
      adminSub.unsubscribe();
      systemSub.unsubscribe();
    };
  }, [user]);

  const deleteNotification = async (id: string, type: 'admin_note' | 'system') => {
    try {
      const table = type === 'admin_note' ? 'admin_notes' : 'notifications';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAsRead = async (id: string, type: 'admin_note' | 'system') => {
    try {
      const table = type === 'admin_note' ? 'admin_notes' : 'notifications';
      const updateField = type === 'admin_note' ? { is_read: true } : { read: true };
      
      const { error } = await supabase
        .from(table)
        .update(updateField)
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.filter(n => !n.is_read).length === 0) return;

    try {
      // Mark admin notes
      await supabase
        .from('admin_notes')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      // Mark system notifications
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const clearAll = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      await supabase
        .from('admin_notes')
        .delete()
        .eq('user_id', user.id);

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      setNotifications([]);
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notification Center</h1>
          <p className="text-slate-500 font-medium">Stay updated with important messages and system alerts.</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#007856] hover:bg-emerald-50 rounded-xl transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowClearConfirm(!showClearConfirm)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
              
              <AnimatePresence>
                {showClearConfirm && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-20"
                  >
                    <p className="text-sm font-bold text-slate-900 mb-3">Clear all notifications?</p>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">This action cannot be undone. All messages and alerts will be permanently deleted.</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={clearAll}
                        className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Yes, Clear
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bell className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">All caught up!</h3>
          <p className="text-slate-500 font-medium max-w-xs mx-auto">
            You don't have any new notifications at the moment. We'll let you know when something important happens.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {notifications.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => !note.is_read && markAsRead(note.id, note.type)}
                className={`bg-white rounded-2xl p-6 border transition-all group relative cursor-pointer ${
                  note.is_read ? 'border-slate-100 shadow-sm opacity-80' : 'border-indigo-100 shadow-md ring-1 ring-indigo-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    note.type === 'admin_note' ? 'bg-indigo-50' : 'bg-emerald-50'
                  }`}>
                    {note.type === 'admin_note' ? (
                      <Info className={`w-6 h-6 ${note.is_read ? 'text-slate-400' : 'text-indigo-600'}`} />
                    ) : (
                      <AlertCircle className={`w-6 h-6 ${note.is_read ? 'text-slate-400' : 'text-emerald-600'}`} />
                    )}
                  </div>
                  <div className="flex-1 pr-8">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                        note.type === 'admin_note' 
                          ? 'text-indigo-600 bg-indigo-50' 
                          : 'text-emerald-600 bg-emerald-50'
                      }`}>
                        {note.type === 'admin_note' ? 'Admin Message' : (note.system_type?.replace('_', ' ') || 'System Alert')}
                      </span>
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(note.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className={`font-medium leading-relaxed ${note.is_read ? 'text-slate-500' : 'text-slate-900'}`}>
                      {note.message}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(note.id, note.type);
                    }}
                    className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-start gap-4">
        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-900">Security Tip</h4>
          <p className="text-sm text-emerald-800/80 mt-1 leading-relaxed">
            NovaBank will never ask for your password or OTP over the phone. If you receive a suspicious message, please report it to our support team immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
