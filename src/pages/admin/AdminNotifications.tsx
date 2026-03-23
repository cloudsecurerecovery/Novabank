import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Bell, 
  Send, 
  Loader2, 
  Users, 
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Megaphone
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system';

export default function AdminNotifications() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('info');
  const [sending, setSending] = useState(false);
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [specificEmail, setSpecificEmail] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    if (target === 'specific' && !specificEmail.trim()) return;

    setSending(true);
    try {
      let userIds: string[] = [];

      if (target === 'all') {
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id');
        if (usersError) throw usersError;
        userIds = users.map(u => u.id);
      } else {
        const { data: user, error: userError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', specificEmail.toLowerCase())
          .single();
        if (userError || !user) throw new Error('User not found');
        userIds = [user.id];
      }

      const notifications = userIds.map(uid => ({
        user_id: uid,
        type,
        message: `${title}: ${message}`,
        read: false
      }));

      const { error: notifyError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifyError) throw notifyError;

      toast.success(`Notification sent to ${target === 'all' ? 'all users' : specificEmail}`);
      setTitle('');
      setMessage('');
      setSpecificEmail('');
    } catch (err: any) {
      console.error('Error sending notification:', err);
      toast.error(err.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Broadcast Center</h1>
        <p className="text-slate-500 font-medium">Send system-wide announcements or targeted alerts to users.</p>
      </div>

      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
        <form onSubmit={handleSend} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Notification Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'info', icon: Info, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { id: 'success', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { id: 'warning', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { id: 'error', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id as NotificationType)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      type === t.id 
                        ? `${t.bg} border-${t.id === 'info' ? 'blue' : t.id === 'success' ? 'emerald' : t.id === 'warning' ? 'amber' : 'rose'}-200` 
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <t.icon className={`w-5 h-5 ${t.color}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${type === t.id ? t.color : 'text-slate-500'}`}>
                      {t.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Target Audience</label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setTarget('all')}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    target === 'all' ? 'bg-emerald-50 border-emerald-200 text-[#007856]' : 'bg-white border-slate-100 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider">All Users</span>
                  </div>
                  {target === 'all' && <CheckCircle2 className="w-4 h-4" />}
                </button>
                <div className={`space-y-3 p-4 rounded-2xl border transition-all ${
                  target === 'specific' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
                }`}>
                  <button
                    type="button"
                    onClick={() => setTarget('specific')}
                    className={`w-full flex items-center justify-between transition-all ${
                      target === 'specific' ? 'text-[#007856]' : 'text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Megaphone className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-wider">Specific User</span>
                    </div>
                    {target === 'specific' && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  {target === 'specific' && (
                    <input 
                      type="email"
                      value={specificEmail}
                      onChange={(e) => setSpecificEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-white border-none rounded-xl py-2 px-4 text-xs font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Notification Title</label>
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., System Maintenance"
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Message Content</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter the detailed message for users..."
                rows={4}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all font-medium resize-none"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={sending || !title.trim() || !message.trim()}
              className="w-full flex items-center justify-center gap-3 py-5 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Broadcast Notification
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex items-start gap-4">
        <div className="p-3 bg-white rounded-2xl shadow-sm">
          <Bell className="w-6 h-6 text-[#007856]" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Notification Guidelines</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            Notifications are sent in real-time to active users and stored for offline users. Use broadcasts for critical system updates, security alerts, or important policy changes. Avoid excessive messaging to maintain user trust.
          </p>
        </div>
      </div>
    </div>
  );
}
