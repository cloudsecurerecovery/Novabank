import { supabase } from '../supabaseClient';

export type NotificationType = 'login' | 'password_change' | 'large_transaction' | 'transfer_received' | 'transfer_sent' | 'deposit' | 'wire_transfer';

export const notificationService = {
  async notify(userId: string, type: NotificationType, message: string) {
    try {
      // 1. Store in notifications table for in-app notifications
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        type,
        message,
        read: false,
        created_at: new Date().toISOString()
      });
      
      if (error) {
        console.warn('Notification table might not exist or error occurred:', error.message);
      }

      // 2. Simulate sending a real email
      // In a real app, you would use a service like SendGrid, Mailgun, or Supabase Edge Functions
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      const userEmail = profile?.email || 'user@example.com';
      const userName = profile?.full_name || 'Valued Customer';
      
      const subjects: Record<NotificationType, string> = {
        'login': 'Security Alert: New Login Detected',
        'password_change': 'Security Alert: Password Changed',
        'large_transaction': 'Security Alert: Large Transaction Processed',
        'transfer_received': 'Funds Received',
        'transfer_sent': 'Funds Sent',
        'deposit': 'Deposit Processed',
        'wire_transfer': 'Wire Transfer Initiated'
      };

      const subject = subjects[type] || 'NovaBank Notification';

      console.log(`
--- [EMAIL SENT] ---
To: ${userName} <${userEmail}>
Subject: ${subject}
Message: ${message}
--------------------
      `);

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
};
