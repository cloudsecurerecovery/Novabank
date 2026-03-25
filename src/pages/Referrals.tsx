import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Gift, 
  Copy, 
  Share2, 
  CheckCircle2, 
  Clock, 
  Send,
  Mail,
  ArrowRight,
  Trophy,
  Star,
  Zap
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface Referral {
  id: string;
  referred_email: string;
  status: 'pending' | 'joined' | 'rewarded';
  reward_amount: number;
  created_at: string;
}

const Referrals: React.FC = () => {
  const { user } = useAuthStore();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const referralCode = user?.id.slice(0, 8).toUpperCase() || 'NOVA-REF';

  useEffect(() => {
    if (user) {
      fetchReferrals();
    }
  }, [user]);

  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReferrals(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('referrals')
        .insert([{
          referrer_id: user.id,
          referred_email: email,
          status: 'pending'
        }]);

      if (error) throw error;

      toast.success('Invitation sent successfully');
      setEmail('');
      fetchReferrals();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}/register?ref=${referralCode}`;
    const shareData = {
      title: 'Join Nova Bank',
      text: `Join me on Nova Bank and get a $25 bonus when you sign up using my referral code: ${referralCode}`,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully');
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const totalRewards = referrals
    .filter(r => r.status === 'rewarded')
    .reduce((acc, r) => acc + r.reward_amount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Refer & Earn</h1>
        <p className="text-gray-400 text-sm">Invite your friends and earn rewards for every successful signup</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Referral Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-gradient-to-br from-[#007856] to-[#005a41] rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Gift className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold">Invite Friends, Get $25</h2>
              </div>
              
              <p className="text-white/80 mb-8 max-w-md">
                Share your referral link with friends. When they join and verify their account, you both get a $25 bonus.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/20">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/60 mb-1">Your Referral Code</p>
                    <p className="text-lg font-mono font-bold">{referralCode}</p>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(referralCode)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={handleShareLink}
                  className="px-8 py-4 bg-white text-[#007856] rounded-2xl font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Share Link
                </button>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-black/10 rounded-full blur-3xl" />
          </div>

          {/* Invite Form */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#007856]" />
              Send Email Invitation
            </h3>
            <form onSubmit={handleSendInvite} className="flex gap-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#007856]"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-[#007856] text-white rounded-xl font-bold hover:bg-[#006347] transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </div>

          {/* Referral History */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Referral History</h3>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Loading history...</div>
              ) : referrals.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No referrals yet. Start inviting!</div>
              ) : (
                referrals.map((ref) => (
                  <div key={ref.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{ref.referred_email}</p>
                        <p className="text-xs text-gray-500">Invited on {new Date(ref.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ref.status === 'rewarded' ? 'bg-green-500/10 text-green-500' :
                        ref.status === 'joined' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {ref.status}
                      </span>
                      {ref.status === 'rewarded' && (
                        <p className="text-xs text-green-500 mt-1 font-bold">+$25.00</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Stats & Leaderboard */}
        <div className="space-y-8">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Your Impact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl">
                <p className="text-xs text-gray-400 mb-1">Total Earned</p>
                <p className="text-2xl font-bold text-white">${totalRewards.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl">
                <p className="text-xs text-gray-400 mb-1">Successful</p>
                <p className="text-2xl font-bold text-white">{referrals.filter(r => r.status === 'rewarded').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Top Referrers
            </h3>
            <div className="space-y-4">
              {[
                { name: 'Alex M.', count: 42, reward: '$1,050' },
                { name: 'Sarah J.', count: 38, reward: '$950' },
                { name: 'David K.', count: 25, reward: '$625' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-500 w-4">{i + 1}</span>
                    <span className="text-sm text-white">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-[#007856]">{item.count} refs</p>
                    <p className="text-[10px] text-gray-500">{item.reward}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-dashed border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h4 className="font-bold text-white">Pro Tip</h4>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Users who share their referral link on social media are 3x more likely to earn rewards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Referrals;
