import { supabase } from '../supabaseClient';

export type AuditAction = 
  | 'login' 
  | 'logout' 
  | 'transfer_sent' 
  | 'transfer_received' 
  | 'profile_update' 
  | 'avatar_update'
  | 'avatar_remove'
  | 'admin_deposit' 
  | 'admin_bulk_deposit'
  | 'admin_transaction_create'
  | 'admin_notification' 
  | 'transaction_status_change'
  | 'password_change'
  | 'registration'
  | 'deposit'
  | 'wire_transfer'
  | 'admin_profile_update'
  | 'admin_otp_sent';

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  details: any;
  ip_address?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export const auditService = {
  async log(userId: string, action: AuditAction, details: any = {}) {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        details,
        created_at: new Date().toISOString()
      });

      if (error) {
        // Fallback to notifications if audit_logs doesn't exist
        console.warn('Audit log table might not exist, falling back to notifications:', error.message);
        await supabase.from('notifications').insert({
          user_id: userId,
          type: action as any,
          message: `Audit: ${action} - ${JSON.stringify(details)}`,
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  },

  async getLogs(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        // If audit_logs fails, try notifications
        const { data: notifs, error: notifError } = await supabase
          .from('notifications')
          .select(`
            *,
            profiles:user_id (
              email,
              full_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (notifError) throw notifError;
        return notifs.map(n => ({
          id: n.id,
          user_id: n.user_id,
          action: n.type as AuditAction,
          details: { message: n.message },
          created_at: n.created_at,
          user_email: n.profiles?.email,
          user_name: n.profiles?.full_name
        }));
      }

      return data.map(log => ({
        ...log,
        user_email: log.profiles?.email,
        user_name: log.profiles?.full_name
      }));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }
};
