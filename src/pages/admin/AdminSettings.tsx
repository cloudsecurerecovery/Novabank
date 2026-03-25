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
  RefreshCw,
  X,
  Plus,
  Trash2
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

  // Advanced Modals
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [showAutoVerifyModal, setShowAutoVerifyModal] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [newRate, setNewRate] = useState({ from: '', to: '', rate: 1 });

  const handleAddRate = async () => {
    try {
      if (!newRate.from || !newRate.to) return toast.error('Please fill all fields');
      const { error } = await supabase
        .from('exchange_rates')
        .insert([{ 
          from_currency: newRate.from.toUpperCase(), 
          to_currency: newRate.to.toUpperCase(), 
          rate: newRate.rate 
        }]);
      if (error) throw error;
      toast.success('Rate pair added');
      setNewRate({ from: '', to: '', rate: 1 });
      fetchRates();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteRate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Rate pair deleted');
      fetchRates();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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

  const fetchRates = async () => {
    try {
      setRatesLoading(true);
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('from_currency');
      if (error) throw error;
      setExchangeRates(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRatesLoading(false);
    }
  };

  const handleUpdateRate = async (id: string, newRate: number) => {
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .update({ rate: newRate, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Rate updated');
      fetchRates();
    } catch (err: any) {
      toast.error(err.message);
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

        {/* Loan Settings */}
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <RefreshCw className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Loan Configuration</h2>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Interest Rate (%)</label>
              <input 
                type="number"
                step="0.1"
                value={settings.default_interest_rate || 5.5}
                onChange={(e) => handleUpdateSetting('default_interest_rate', Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max Loan Amount</label>
                <input 
                  type="number"
                  value={settings.max_loan_amount || 50000}
                  onChange={(e) => handleUpdateSetting('max_loan_amount', Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max Term (Months)</label>
                <input 
                  type="number"
                  value={settings.max_loan_term || 60}
                  onChange={(e) => handleUpdateSetting('max_loan_term', Number(e.target.value))}
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
            <button 
              onClick={() => setShowAutoVerifyModal(true)}
              className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all"
            >
              Configure
            </button>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <ArrowRightLeft className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Exchange Rates</span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Manage real-time exchange rates for international wires.</p>
            <button 
              onClick={() => { setShowRatesModal(true); fetchRates(); }}
              className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all"
            >
              Manage Rates
            </button>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 text-purple-600">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Fraud Detection</span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Adjust AI sensitivity for suspicious transaction flagging.</p>
            <button 
              onClick={() => setShowFraudModal(true)}
              className="w-full py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all"
            >
              Tune AI
            </button>
          </div>
        </div>
      </div>

      {/* Exchange Rates Modal */}
      {showRatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Exchange Rates</h2>
              <button onClick={() => setShowRatesModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              {ratesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
                </div>
              ) : exchangeRates.map((rate) => (
                <div key={rate.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-bold text-[#007856] shadow-sm">
                      {rate.from_currency}
                    </div>
                    <ArrowRightLeft className="w-4 h-4 text-slate-300" />
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-bold text-blue-600 shadow-sm">
                      {rate.to_currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number"
                      step="0.0001"
                      defaultValue={rate.rate}
                      onBlur={(e) => handleUpdateRate(rate.id, Number(e.target.value))}
                      className="w-32 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                    />
                    <button 
                      onClick={() => handleDeleteRate(rate.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Add New Exchange Pair</p>
                <div className="grid grid-cols-3 gap-4">
                  <input 
                    placeholder="FROM (USD)"
                    value={newRate.from}
                    onChange={e => setNewRate(prev => ({ ...prev, from: e.target.value }))}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase"
                  />
                  <input 
                    placeholder="TO (EUR)"
                    value={newRate.to}
                    onChange={e => setNewRate(prev => ({ ...prev, to: e.target.value }))}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase"
                  />
                  <input 
                    type="number"
                    step="0.0001"
                    placeholder="Rate"
                    value={newRate.rate}
                    onChange={e => setNewRate(prev => ({ ...prev, rate: Number(e.target.value) }))}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <button 
                  onClick={handleAddRate}
                  className="w-full py-3 bg-[#007856] text-white rounded-xl font-bold hover:bg-[#006649] transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Pair
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Auto-Verification Modal */}
      {showAutoVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Auto-Verification</h2>
              <button onClick={() => setShowAutoVerifyModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Enable Auto-KYC</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Allow system to verify documents automatically.</p>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('auto_kyc_enabled', !settings.auto_kyc_enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      settings.auto_kyc_enabled ? 'bg-[#007856]' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.auto_kyc_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Minimum Trust Score (0-100)</label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={settings.min_trust_score || 85}
                    onChange={(e) => handleUpdateSetting('min_trust_score', Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#007856]/20 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">AI Document Check</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Use AI to verify ID authenticity.</p>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('ai_doc_check', !settings.ai_doc_check)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      settings.ai_doc_check ? 'bg-[#007856]' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.ai_doc_check ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setShowAutoVerifyModal(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
              >
                Close & Apply
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showFraudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Fraud Detection</h2>
              <button onClick={() => setShowFraudModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Sensitivity Level</label>
                <div className="flex items-center justify-between gap-4">
                  {['Low', 'Medium', 'High', 'Strict'].map((level) => (
                    <button
                      key={level}
                      onClick={() => handleUpdateSetting('fraud_sensitivity', level.toLowerCase())}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                        (settings.fraud_sensitivity || 'medium') === level.toLowerCase()
                          ? 'bg-[#007856] text-white shadow-lg shadow-emerald-100'
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Auto-Flag Large Transfers</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Flag transfers over $10,000.</p>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('flag_large_transfers', !settings.flag_large_transfers)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      settings.flag_large_transfers ? 'bg-[#007856]' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.flag_large_transfers ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Geographic Blocking</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Block logins from high-risk regions.</p>
                  </div>
                  <button 
                    onClick={() => handleUpdateSetting('geo_blocking', !settings.geo_blocking)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      settings.geo_blocking ? 'bg-[#007856]' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.geo_blocking ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setShowFraudModal(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
              >
                Close & Apply
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
