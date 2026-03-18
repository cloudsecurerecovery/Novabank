import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../supabaseClient';
import { Send, UserCircle, MessageSquare, Search, ShieldCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarImage } from '../../components/AvatarImage';

interface ChatMessage {
  id: string;
  message: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export default function AdminChat() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .neq('id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) setUsers(data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (!selectedUserId || !user) return;

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (data) setMessages(data);
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      }
    };

    fetchHistory();

    const subscription = supabase
      .channel(`admin-chat-${selectedUserId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `sender_id=eq.${selectedUserId}`
      }, (payload) => {
        if (payload.new.receiver_id === user.id) {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `sender_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.receiver_id === selectedUserId) {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as ChatMessage];
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedUserId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUserId || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user.id,
          receiver_id: selectedUserId,
          message: messageText
        }]);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(messageText);
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007856]"></div>
      </div>
    );
  }

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
        <div className="p-6 bg-white border-b border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-[#007856]/10 rounded-xl">
              <MessageSquare className="h-5 w-5 text-[#007856]" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Support Center</h2>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#007856]/20 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`w-full flex items-center p-3 rounded-2xl transition-all ${
                  selectedUserId === u.id 
                    ? 'bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100' 
                    : 'hover:bg-white/50 text-slate-600'
                }`}
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
                  selectedUserId === u.id ? 'bg-[#007856]' : 'bg-slate-200'
                }`}>
                  <AvatarImage 
                    avatarUrl={u.avatar_url} 
                    fullName={u.full_name} 
                  />
                </div>
                <div className="ml-3 text-left overflow-hidden">
                  <p className={`text-sm font-bold truncate ${selectedUserId === u.id ? 'text-slate-900' : 'text-slate-700'}`}>
                    {u.full_name || 'Unknown User'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{u.email}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No customers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedUserId ? (
          <>
            {/* Chat Header */}
            <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#007856]/10 flex items-center justify-center overflow-hidden">
                  <AvatarImage 
                    avatarUrl={selectedUser?.avatar_url} 
                    fullName={selectedUser?.full_name} 
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{selectedUser?.full_name}</h2>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active Now</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Secure Channel</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
              <AnimatePresence initial={false}>
                {messages.map((msg, index) => {
                  const isMe = msg.sender_id === user?.id;
                  const showTime = index === 0 || 
                    new Date(msg.created_at).getTime() - new Date(messages[index-1].created_at).getTime() > 300000;
                  
                  return (
                    <motion.div 
                      key={msg.id || index}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      {showTime && (
                        <div className="w-full flex justify-center my-4">
                          <span className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest shadow-sm">
                            {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                      )}
                      <div className={`flex items-end gap-3 max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`px-5 py-3.5 rounded-3xl shadow-sm ${
                          isMe 
                            ? 'bg-[#007856] text-white rounded-br-none' 
                            : 'bg-white border border-slate-100 text-slate-900 rounded-bl-none'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-300 mb-1">
                          {format(new Date(msg.created_at), 'h:mm a')}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-slate-100">
              <form onSubmit={handleSendMessage} className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your response..."
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-slate-900 focus:ring-2 focus:ring-[#007856]/20 transition-all placeholder:text-slate-400 font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-8 py-4 bg-[#007856] text-white font-bold rounded-2xl hover:bg-[#006045] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="h-5 w-5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50/30 p-12 text-center">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-8">
              <MessageSquare className="h-12 w-12 text-[#007856]/20" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Conversation</h3>
            <p className="text-slate-500 max-w-xs font-medium">Choose a customer from the sidebar to view their support history and respond to inquiries.</p>
          </div>
        )}
      </div>
    </div>
  );
}
