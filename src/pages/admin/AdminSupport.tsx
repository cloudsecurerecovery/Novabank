import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../../store/authStore';
import { 
  MessageSquare, 
  Search,
  Loader2,
  Send,
  User,
  CheckCircle2,
  Clock,
  ArrowLeft,
  MoreVertical,
  Phone,
  Mail,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface Conversation {
  user_id: string;
  full_name: string;
  email: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export default function AdminSupport() {
  const { user: adminUser } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    
    // Subscribe to new messages
    const subscription = supabase
      .channel('admin_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, () => {
        fetchConversations();
        if (selectedUserId) {
          fetchMessages(selectedUserId);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      // Fetch all messages involving 'admin'
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id (
            id,
            full_name,
            email
          ),
          receiver:receiver_id (
            id,
            full_name,
            email
          )
        `)
        .or('sender_id.eq.admin,receiver_id.eq.admin')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const conversationMap = new Map<string, Conversation>();
      
      data?.forEach(msg => {
        // The "other" person in the conversation is the one who isn't 'admin'
        const userId = msg.sender_id === 'admin' ? msg.receiver_id : msg.sender_id;
        if (userId === 'admin' || !userId) return;

        if (!conversationMap.has(userId)) {
          // Get profile info for the user
          const profile = msg.sender_id === userId ? msg.sender : msg.receiver;
          
          conversationMap.set(userId, {
            user_id: userId,
            full_name: (profile as any)?.full_name || 'User',
            email: (profile as any)?.email || 'user@novabank.com',
            last_message: msg.message,
            last_message_at: msg.created_at,
            unread_count: (msg.receiver_id === 'admin' && !msg.is_read) ? 1 : 0
          });
        } else {
          if (msg.receiver_id === 'admin' && !msg.is_read) {
            const conv = conversationMap.get(userId)!;
            conv.unread_count += 1;
          }
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      setMessagesLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id (
            full_name,
            email
          )
        `)
        .or(`and(sender_id.eq.${userId},receiver_id.eq.admin),and(sender_id.eq.admin,receiver_id.eq.${userId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', userId)
        .eq('receiver_id', 'admin');

    } catch (err) {
      console.error('Error fetching messages:', err);
      toast.error('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUserId || !adminUser) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          sender_id: 'admin', // Use 'admin' as sender_id for support replies
          receiver_id: selectedUserId,
          message: newMessage.trim(),
          is_read: false
        }]);

      if (error) throw error;
      setNewMessage('');
      // Optimistically add message or let subscription handle it
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };

  const filteredConversations = conversations.filter(conv => 
    conv.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedConversation = conversations.find(c => c.user_id === selectedUserId);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#007856]" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Sidebar - Conversation List */}
      <div className={`w-full md:w-80 border-r border-slate-50 flex flex-col ${selectedUserId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-slate-50">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Support Chat</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs focus:ring-2 focus:ring-[#007856]/20 transition-all font-medium"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.user_id}
                onClick={() => setSelectedUserId(conv.user_id)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50/50 ${
                  selectedUserId === conv.user_id ? 'bg-emerald-50/50' : ''
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm">
                    {conv.full_name.charAt(0)}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="text-sm font-bold text-slate-900 truncate">{conv.full_name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {format(new Date(conv.last_message_at), 'HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate font-medium">{conv.last_message}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-slate-50/30 ${!selectedUserId ? 'hidden md:flex' : 'flex'}`}>
        {selectedUserId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedUserId(null)}
                  className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm">
                  {selectedConversation?.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedConversation?.full_name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <Mail className="w-5 h-5" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#007856]" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.sender_id === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] space-y-1`}>
                      <div className={`p-4 rounded-2xl text-sm font-medium shadow-sm ${
                        msg.sender_id === 'admin' 
                          ? 'bg-[#007856] text-white rounded-tr-none' 
                          : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                      }`}>
                        {msg.message}
                      </div>
                      <div className={`flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest ${
                        msg.sender_id === 'admin' ? 'justify-end' : 'justify-start'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {format(new Date(msg.created_at), 'HH:mm')}
                        {msg.sender_id === 'admin' && (
                          <CheckCircle2 className={`w-3 h-3 ${msg.is_read ? 'text-emerald-500' : 'text-slate-300'}`} />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-50">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-3 text-sm font-medium focus:ring-2 focus:ring-[#007856]/20 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-3 bg-[#007856] text-white rounded-2xl hover:bg-[#006045] transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-slate-200/50 flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Select a conversation</h3>
            <p className="text-slate-500 mt-2 max-w-xs font-medium">Choose a user from the sidebar to start chatting or view their support history.</p>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> End-to-end Encrypted
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
