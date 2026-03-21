import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../supabaseClient';
import { Send, UserCircle, MessageSquare, ShieldCheck, Clock, Check } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  message: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
}

export default function SupportChat() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (data) setMessages(data);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel('public:messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `sender_id=eq.${user.id}`
      }, (payload) => {
        // Only add if we didn't just add it optimistically
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as ChatMessage];
        });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Find an admin to send the message to
      // In a real app, you might have a specific support queue or assigned agent
      // For this demo, we'll just send it to the first admin we find, or a generic 'admin' ID if none exists
      const { data: adminData } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      const receiverId = adminData?.id || 'admin-system';

      const { error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user.id,
          receiver_id: receiverId,
          message: messageText
        }]);

      if (error) throw error;
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Optionally restore the message text if sending failed
      setNewMessage(messageText);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto h-[calc(100vh-14rem)] flex flex-col bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-[#007856] px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-sm border border-white/20">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">NovaBank Support</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-white/80 font-medium">Agents online</p>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full border border-white/10">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-bold text-white uppercase tracking-wider">End-to-End Encrypted</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <MessageSquare className="h-12 w-12 text-[#007856] opacity-20 mx-auto" />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-xl font-bold text-slate-900">How can we help?</p>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">Our support team is ready to assist you with any questions about your NovaBank account.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => {
                const isMe = msg.sender_id === user?.id;
                const showTime = index === 0 || 
                  new Date(msg.created_at).getTime() - new Date(messages[index-1].created_at).getTime() > 300000; // 5 mins
                
                return (
                  <motion.div 
                    key={msg.id || index}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {showTime && (
                      <div className="w-full flex justify-center my-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                          {format(new Date(msg.created_at), 'EEEE, h:mm a')}
                        </span>
                      </div>
                    )}
                    <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMe && (
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#007856] flex items-center justify-center text-white shadow-sm">
                          <span className="text-[10px] font-bold">NB</span>
                        </div>
                      )}
                      <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                        isMe 
                          ? 'bg-[#007856] text-white rounded-tr-none' 
                          : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none'
                      }`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                        <div className={`flex items-center gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[9px] font-medium ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </span>
                          {isMe && <Check className="w-3 h-3 text-emerald-400" />}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-slate-50 border-none rounded-2xl py-3.5 pl-5 pr-12 text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-[#007856] text-white disabled:opacity-30 disabled:grayscale transition-all hover:bg-[#006045] shadow-lg shadow-emerald-200"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
        <p className="text-[10px] text-center text-slate-400 mt-3 font-medium uppercase tracking-wider">
          NovaBank Secure Messenger
        </p>
      </div>
    </motion.div>
  );
}
