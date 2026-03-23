import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Settings, 
  Save, 
  Loader2, 
  ShieldAlert, 
  DollarSign, 
  ArrowRightLeft, 
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface SystemSetting {
  key: string;
  value: any;
  updated_at: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;
      
      const settingsMap: Record<string, any> = {};
      data?.forEach(s => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error('Error fetching settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('system_settings')
        .upsert(updates);

      if (error) throw error;
      toast.success('Settings updated successfully');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-slate-500 font-medium">Configure global application parameters and security thresholds.</p>
        </div>
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-4 bg-[#007856] text-white rounded-2xl font-bold hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Security & Maintenance */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 rounded-2xl">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Security & Maintenance</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">Maintenance Mode</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Restrict access to all users except admins.</p>
              </div>
              <button 
                onClick={() => handleUpdateSetting('maintenance_mode', !settings.maintenance_mode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.maintenance_mode ? 'bg-rose-500' : 'bg-slate-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Enabling maintenance mode will immediately disconnect all active user sessions and prevent new logins. Use with caution.
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Limits */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Transaction Limits</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Daily Limit (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="number"
                  value={settings.default_daily_limit}
                  onChange={(e) => handleUpdateSetting('default_daily_limit', Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min Transfer</label>
                <input 
                  type="number"
                  value={settings.min_transfer_amount}
                  onChange={(e) => handleUpdateSetting('min_transfer_amount', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max Transfer</label>
                <input 
                  type="number"
                  value={settings.max_transfer_amount}
                  onChange={(e) => handleUpdateSetting('max_transfer_amount', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Configuration */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 rounded-2xl">
            <RefreshCw className="w-6 h-6 text-slate-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Advanced Configuration</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-[#007856]">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Auto-Verification</span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Automatically verify KYC for users with high trust scores.</p>
            <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all">
              Configure
            </button>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <ArrowRightLeft className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Exchange Rates</span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Manage real-time exchange rates for international wires.</p>
            <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all">
              Manage Rates
            </button>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-purple-600">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Fraud Detection</span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Adjust AI sensitivity for suspicious transaction flagging.</p>
            <button className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all">
              Tune AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
