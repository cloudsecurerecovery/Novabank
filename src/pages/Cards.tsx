import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../store/authStore';
import { 
  CreditCard, 
  Plus, 
  Lock, 
  Unlock, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface Card {
  id: string;
  card_number: string;
  card_holder_name: string;
  expiry_date: string;
  cvv: string;
  card_type: 'debit' | 'credit';
  status: 'active' | 'frozen' | 'blocked';
  created_at: string;
}

export default function Cards() {
  const { user } = useAuthStore();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showNumbers, setShowNumbers] = useState<Record<string, boolean>>({});
  
  // New Card Form
  const [newCardType, setNewCardType] = useState<'debit' | 'credit'>('debit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCards();
    }
  }, [user]);

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      console.error('Error fetching cards:', err);
      toast.error('Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCard = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      // Generate random card details
      const cardNumber = Array.from({ length: 4 }, () => 
        Math.floor(1000 + Math.random() * 9000)
      ).join(' ');
      
      const expiryMonth = Math.floor(1 + Math.random() * 12).toString().padStart(2, '0');
      const expiryYear = (new Date().getFullYear() + 4).toString().slice(-2);
      const cvv = Math.floor(100 + Math.random() * 900).toString();

      const { error } = await supabase
        .from('cards')
        .insert([{
          user_id: user.id,
          card_number: cardNumber,
          card_holder_name: user.full_name,
          expiry_date: `${expiryMonth}/${expiryYear}`,
          cvv: cvv,
          card_type: newCardType,
          status: 'active'
        }]);

      if (error) throw error;

      toast.success(`${newCardType.charAt(0).toUpperCase() + newCardType.slice(1)} card issued successfully!`);
      setIsAdding(false);
      fetchCards();
    } catch (err) {
      console.error('Error requesting card:', err);
      toast.error('Failed to request card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFreeze = async (cardId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'frozen' : 'active';
    try {
      const { error } = await supabase
        .from('cards')
        .update({ status: newStatus })
        .eq('id', cardId);

      if (error) throw error;
      
      setCards(cards.map(c => c.id === cardId ? { ...c, status: newStatus as any } : c));
      toast.success(newStatus === 'frozen' ? 'Card frozen' : 'Card unfrozen');
    } catch (err) {
      console.error('Error toggling freeze:', err);
      toast.error('Failed to update card status');
    }
  };

  const deleteCard = async (cardId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this card?')) return;
    
    try {
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
      
      setCards(cards.filter(c => c.id !== cardId));
      toast.success('Card deleted');
    } catch (err) {
      console.error('Error deleting card:', err);
      toast.error('Failed to delete card');
    }
  };

  const toggleShowNumber = (id: string) => {
    setShowNumbers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Cards</h1>
          <p className="text-slate-500 font-medium">Manage your physical and virtual cards.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#007856] text-white rounded-2xl font-bold hover:bg-[#006347] transition-all shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" />
          Request New Card
        </button>
      </div>

      {cards.length === 0 && !isAdding ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No cards found</h2>
          <p className="text-slate-500 mt-2 mb-8">You haven't requested any cards yet. Start by requesting a virtual debit or credit card.</p>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
          >
            Issue My First Card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl p-6 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-[#007856]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">New Card Request</h3>
                  <p className="text-xs text-slate-500 mt-1">Select the type of card you want to issue.</p>
                </div>
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => setNewCardType('debit')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${newCardType === 'debit' ? 'bg-[#007856] text-white' : 'bg-slate-50 text-slate-600'}`}
                  >
                    Debit
                  </button>
                  <button 
                    onClick={() => setNewCardType('credit')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${newCardType === 'credit' ? 'bg-[#007856] text-white' : 'bg-slate-50 text-slate-600'}`}
                  >
                    Credit
                  </button>
                </div>
                <div className="flex gap-2 w-full pt-2">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleRequestCard}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Confirm
                  </button>
                </div>
              </motion.div>
            )}

            {cards.map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group"
              >
                {/* Visual Card */}
                <div className={`relative h-52 rounded-3xl p-8 text-white overflow-hidden shadow-2xl transition-all duration-500 ${
                  card.status === 'frozen' ? 'grayscale' : ''
                } ${
                  card.card_type === 'credit' 
                    ? 'bg-gradient-to-br from-slate-800 to-slate-950' 
                    : 'bg-gradient-to-br from-[#007856] to-[#004d37]'
                }`}>
                  {/* Card Background Pattern */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full -ml-16 -mb-16 blur-2xl" />
                  
                  <div className="relative h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">NovaBank {card.card_type}</span>
                        <ShieldCheck className="w-5 h-5 mt-1 opacity-80" />
                      </div>
                      <div className="w-12 h-8 bg-white/20 rounded-md backdrop-blur-sm" />
                    </div>

                    <div>
                      <div className="flex items-center gap-3">
                        <p className="text-xl font-mono tracking-[0.2em]">
                          {showNumbers[card.id] ? card.card_number : `•••• •••• •••• ${card.card_number.slice(-4)}`}
                        </p>
                        <button 
                          onClick={() => toggleShowNumber(card.id)}
                          className="p-1 hover:bg-white/10 rounded-md transition-all"
                        >
                          {showNumbers[card.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="flex justify-between items-end mt-6">
                        <div>
                          <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Card Holder</p>
                          <p className="text-sm font-bold tracking-wide">{card.card_holder_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Expires</p>
                          <p className="text-sm font-bold tracking-wide">{card.expiry_date}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">CVV</p>
                          <p className="text-sm font-bold tracking-wide">{showNumbers[card.id] ? card.cvv : '•••'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {card.status === 'frozen' && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="bg-white/90 px-4 py-2 rounded-full flex items-center gap-2 shadow-xl">
                        <Lock className="w-4 h-4 text-slate-900" />
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Frozen</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <button 
                    onClick={() => toggleFreeze(card.id, card.status)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all border ${
                      card.status === 'frozen' 
                        ? 'bg-emerald-50 text-[#007856] border-emerald-100 hover:bg-emerald-100' 
                        : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    {card.status === 'frozen' ? (
                      <>
                        <Unlock className="w-4 h-4" />
                        Unfreeze
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Freeze
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => deleteCard(card.id)}
                    className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl hover:bg-rose-100 transition-all"
                    title="Delete Card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm">
            <ShieldCheck className="w-6 h-6 text-[#007856]" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Security Information</h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Your virtual cards are protected by industry-standard encryption. You can freeze your card at any time if you suspect unauthorized activity. NovaBank will never ask for your full card number or CVV over the phone or via email.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                256-bit Encryption
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Fraud Protection
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Instant Freeze
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
