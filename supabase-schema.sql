-- NovaBank Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
-- Stores extended user information linked to auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  balance NUMERIC DEFAULT 0,
  savings_balance NUMERIC DEFAULT 0,
  loan_balance NUMERIC DEFAULT 0,
  investment_balance NUMERIC DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  role TEXT DEFAULT 'user',
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'frozen', 'blocked', 'pending_kyc')),
  kyc_status TEXT DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
  daily_limit NUMERIC DEFAULT 5000,
  admin_notes TEXT,
  otp_code TEXT,
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Transactions Table
-- Stores all financial movements
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'hold', 'released', 'failed', 'reversible', 'rejected', 'completed')),
  description TEXT,
  admin_notes TEXT,
  resulting_balance NUMERIC,
  balance_type TEXT DEFAULT 'checking' CHECK (balance_type IN ('checking', 'savings', 'loan', 'investment')),
  type TEXT CHECK (type IN ('credit', 'debit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. User Documents Table
-- Stores metadata for uploaded KYC or check documents
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id UUID, -- Optional link to a transaction
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Audit Logs Table
-- Tracks administrative and critical user actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. Messages (Chat) Table
-- Real-time support chat between users and admins
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  receiver_id TEXT NOT NULL, -- Can be a UUID or 'admin'
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Admin Notes (Notifications) Table
-- System notifications sent by admins to users
CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. User Notes Table
-- Personal notes for users (SaaS feature with limits)
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 8. Notifications Table
-- Stores in-app notifications for various events
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 9. Cards Table
-- Stores user debit/credit cards
CREATE TABLE IF NOT EXISTS cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  card_holder_name TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  cvv TEXT NOT NULL,
  card_type TEXT DEFAULT 'debit' CHECK (card_type IN ('debit', 'credit')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 10. System Settings Table
-- Stores global application settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Insert default settings
INSERT INTO system_settings (key, value)
VALUES 
  ('maintenance_mode', 'false'::jsonb),
  ('default_daily_limit', '5000'::jsonb),
  ('min_transfer_amount', '1'::jsonb),
  ('max_transfer_amount', '50000'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- FUNCTIONS & RPCS

-- A. Transfer Funds RPC
-- Handles atomic transfers between two users
CREATE OR REPLACE FUNCTION transfer_funds(
  sender_id UUID,
  receiver_id UUID,
  transfer_amount NUMERIC,
  sender_description TEXT,
  receiver_description TEXT,
  sender_balance_type TEXT DEFAULT 'checking'
) RETURNS BOOLEAN AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  -- Security Check: Only allow user to send from their own account
  IF sender_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only send funds from your own account.';
  END IF;

  -- Validation: Positive amount
  IF transfer_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero.';
  END IF;

  -- Validation: Prevent self-transfer
  IF sender_id = receiver_id THEN
    RAISE EXCEPTION 'You cannot transfer funds to yourself.';
  END IF;

  -- Validation: Check if receiver exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = receiver_id) THEN
    RAISE EXCEPTION 'Recipient account not found.';
  END IF;

  -- Get current balance from profiles (centralized source of truth)
  IF sender_balance_type = 'checking' THEN
    SELECT balance INTO current_balance FROM profiles WHERE id = sender_id;
  ELSIF sender_balance_type = 'savings' THEN
    SELECT savings_balance INTO current_balance FROM profiles WHERE id = sender_id;
  ELSIF sender_balance_type = 'loan' THEN
    SELECT loan_balance INTO current_balance FROM profiles WHERE id = sender_id;
  ELSIF sender_balance_type = 'investment' THEN
    SELECT investment_balance INTO current_balance FROM profiles WHERE id = sender_id;
  ELSE
    RAISE EXCEPTION 'Invalid balance type: %', sender_balance_type;
  END IF;

  -- Check sufficient funds
  IF current_balance < transfer_amount THEN
    RAISE EXCEPTION 'Insufficient funds in % account: Your available balance is %', sender_balance_type, current_balance;
  END IF;

  -- Validation: Check daily limit
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = sender_id 
    AND (
      SELECT COALESCE(SUM(ABS(amount)), 0) 
      FROM transactions 
      WHERE user_id = sender_id 
      AND amount < 0 
      AND created_at >= CURRENT_DATE
    ) + transfer_amount > daily_limit
  ) THEN
    RAISE EXCEPTION 'Daily transfer limit exceeded.';
  END IF;

  -- Atomic Transaction: Debit Sender
  -- The trigger 'on_transaction_change' will automatically update profiles.balance
  INSERT INTO transactions (user_id, amount, status, description, balance_type, type)
  VALUES (sender_id, -transfer_amount, 'released', sender_description, sender_balance_type, 'debit');

  -- Atomic Transaction: Credit Receiver
  INSERT INTO transactions (user_id, amount, status, description, balance_type, type)
  VALUES (receiver_id, transfer_amount, 'released', receiver_description, 'checking', 'credit');

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. OTP Generation RPC
-- Generates a 6-digit OTP and stores it in the profile
CREATE OR REPLACE FUNCTION public.generate_otp(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  new_otp TEXT;
  is_admin_user BOOLEAN;
BEGIN
  -- Security Check: Allow self or admin
  SELECT is_admin INTO is_admin_user FROM public.profiles WHERE id = auth.uid();
  
  IF target_user_id != auth.uid() AND (is_admin_user IS NULL OR NOT is_admin_user) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Generate 6-digit code
  new_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  UPDATE public.profiles
  SET otp_code = new_otp,
      otp_expires_at = NOW() + INTERVAL '10 minutes'
  WHERE id = target_user_id;
  
  RETURN new_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. OTP Verification RPC
-- Verifies the OTP and clears it upon success
CREATE OR REPLACE FUNCTION public.verify_otp(target_user_id UUID, input_otp TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_otp TEXT;
  expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Security Check: Only allow user to verify for themselves
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT otp_code, otp_expires_at INTO stored_otp, expires_at
  FROM public.profiles
  WHERE id = target_user_id;

  -- Validation
  IF stored_otp IS NULL OR stored_otp != input_otp THEN
    RETURN FALSE;
  END IF;

  IF expires_at < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Success: Clear OTP
  UPDATE public.profiles
  SET otp_code = NULL, otp_expires_at = NULL
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C2. Submit KYC RPC
-- Updates the user's KYC status to 'pending'
CREATE OR REPLACE FUNCTION public.submit_kyc(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Security Check: Only allow user to submit for themselves
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET kyc_status = 'pending'
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C2. Submit KYC RPC
-- Updates the user's KYC status to 'pending'
CREATE OR REPLACE FUNCTION public.submit_kyc(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Security Check: Only allow user to submit for themselves
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET kyc_status = 'pending'
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. New User Profile Trigger
-- Automatically creates a profile entry when a new user signs up via Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, is_admin, balance, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    FALSE,
    0,
    'user'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- E. Bulk Deposit RPC
-- Allows admins to deposit funds to all users at once
CREATE OR REPLACE FUNCTION bulk_deposit(
  deposit_amount NUMERIC,
  deposit_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  -- Security Check: Only admins can perform bulk deposits
  SELECT is_admin INTO is_admin_user FROM profiles WHERE id = auth.uid();
  IF is_admin_user IS NULL OR NOT is_admin_user THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can perform bulk deposits.';
  END IF;

  -- Validation: Positive amount
  IF deposit_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be greater than zero.';
  END IF;

  -- Insert transactions for all users
  -- The trigger 'on_transaction_change' will automatically update profiles.balance for each user
  INSERT INTO transactions (user_id, amount, status, description)
  SELECT id, deposit_amount, 'released', deposit_description
  FROM profiles;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F. Balance Update Trigger
-- Automatically updates profiles.balance when transactions are added/modified
CREATE OR REPLACE FUNCTION update_profile_balance()
RETURNS TRIGGER AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  -- Prevent recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  -- We only care about 'released' transactions for the balance
  
  -- INSERT
  IF (TG_OP = 'INSERT' AND NEW.status = 'released') THEN
    IF NEW.balance_type = 'checking' THEN
      UPDATE profiles SET balance = balance + NEW.amount WHERE id = NEW.user_id RETURNING balance INTO new_balance;
    ELSIF NEW.balance_type = 'savings' THEN
      UPDATE profiles SET savings_balance = COALESCE(savings_balance, 0) + NEW.amount WHERE id = NEW.user_id RETURNING savings_balance INTO new_balance;
    ELSIF NEW.balance_type = 'loan' THEN
      UPDATE profiles SET loan_balance = COALESCE(loan_balance, 0) + NEW.amount WHERE id = NEW.user_id RETURNING loan_balance INTO new_balance;
    ELSIF NEW.balance_type = 'investment' THEN
      UPDATE profiles SET investment_balance = COALESCE(investment_balance, 0) + NEW.amount WHERE id = NEW.user_id RETURNING investment_balance INTO new_balance;
    END IF;
    
    -- Update the transaction with the resulting balance
    UPDATE transactions SET resulting_balance = new_balance WHERE id = NEW.id;
  
  -- UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Status changed to released
    IF (OLD.status != 'released' AND NEW.status = 'released') THEN
      IF NEW.balance_type = 'checking' THEN
        UPDATE profiles SET balance = balance + NEW.amount WHERE id = NEW.user_id RETURNING balance INTO new_balance;
      ELSIF NEW.balance_type = 'savings' THEN
        UPDATE profiles SET savings_balance = COALESCE(savings_balance, 0) + NEW.amount WHERE id = NEW.user_id RETURNING savings_balance INTO new_balance;
      ELSIF NEW.balance_type = 'loan' THEN
        UPDATE profiles SET loan_balance = COALESCE(loan_balance, 0) + NEW.amount WHERE id = NEW.user_id RETURNING loan_balance INTO new_balance;
      ELSIF NEW.balance_type = 'investment' THEN
        UPDATE profiles SET investment_balance = COALESCE(investment_balance, 0) + NEW.amount WHERE id = NEW.user_id RETURNING investment_balance INTO new_balance;
      END IF;
      
      UPDATE transactions SET resulting_balance = new_balance WHERE id = NEW.id;
      
    -- Status changed FROM released
    ELSIF (OLD.status = 'released' AND NEW.status != 'released') THEN
      IF OLD.balance_type = 'checking' THEN
        UPDATE profiles SET balance = balance - OLD.amount WHERE id = OLD.user_id RETURNING balance INTO new_balance;
      ELSIF OLD.balance_type = 'savings' THEN
        UPDATE profiles SET savings_balance = COALESCE(savings_balance, 0) - OLD.amount WHERE id = OLD.user_id RETURNING savings_balance INTO new_balance;
      ELSIF OLD.balance_type = 'loan' THEN
        UPDATE profiles SET loan_balance = COALESCE(loan_balance, 0) - OLD.amount WHERE id = OLD.user_id RETURNING loan_balance INTO new_balance;
      ELSIF OLD.balance_type = 'investment' THEN
        UPDATE profiles SET investment_balance = COALESCE(investment_balance, 0) - OLD.amount WHERE id = OLD.user_id RETURNING investment_balance INTO new_balance;
      END IF;
      
      UPDATE transactions SET resulting_balance = new_balance WHERE id = NEW.id;
      
    -- Amount changed while remaining released
    ELSIF (OLD.status = 'released' AND NEW.status = 'released' AND OLD.amount != NEW.amount) THEN
      IF NEW.balance_type = 'checking' THEN
        UPDATE profiles SET balance = balance - OLD.amount + NEW.amount WHERE id = NEW.user_id RETURNING balance INTO new_balance;
      ELSIF NEW.balance_type = 'savings' THEN
        UPDATE profiles SET savings_balance = COALESCE(savings_balance, 0) - OLD.amount + NEW.amount WHERE id = NEW.user_id RETURNING savings_balance INTO new_balance;
      ELSIF NEW.balance_type = 'loan' THEN
        UPDATE profiles SET loan_balance = COALESCE(loan_balance, 0) - OLD.amount + NEW.amount WHERE id = NEW.user_id RETURNING loan_balance INTO new_balance;
      ELSIF NEW.balance_type = 'investment' THEN
        UPDATE profiles SET investment_balance = COALESCE(investment_balance, 0) - OLD.amount + NEW.amount WHERE id = NEW.user_id RETURNING investment_balance INTO new_balance;
      END IF;
      
      UPDATE transactions SET resulting_balance = new_balance WHERE id = NEW.id;
    END IF;
    
  -- DELETE
  ELSIF (TG_OP = 'DELETE' AND OLD.status = 'released') THEN
    IF OLD.balance_type = 'checking' THEN
      UPDATE profiles SET balance = balance - OLD.amount WHERE id = OLD.user_id;
    ELSIF OLD.balance_type = 'savings' THEN
      UPDATE profiles SET savings_balance = COALESCE(savings_balance, 0) - OLD.amount WHERE id = OLD.user_id;
    ELSIF OLD.balance_type = 'loan' THEN
      UPDATE profiles SET loan_balance = COALESCE(loan_balance, 0) - OLD.amount WHERE id = OLD.user_id;
    ELSIF OLD.balance_type = 'investment' THEN
      UPDATE profiles SET investment_balance = COALESCE(investment_balance, 0) - OLD.amount WHERE id = OLD.user_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- G. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Re-create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS on_transaction_change ON transactions;
CREATE TRIGGER on_transaction_change
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE update_profile_balance();

-- ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
-- Users can see their own full profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can see limited info of other users (for transfers)
CREATE POLICY "Users can view limited info of others" ON profiles
  FOR SELECT USING (auth.uid() != id AND auth.role() = 'authenticated');

-- Restrict columns for "view limited info of others"
-- Note: Supabase RLS doesn't natively support column-level SELECT policies easily in a single statement,
-- but we can use views or just be careful in the frontend. 
-- However, we can at least restrict the UPDATE policy.

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    -- Prevent users from changing sensitive fields
    (OLD.balance = NEW.balance) AND
    (OLD.is_admin = NEW.is_admin) AND
    (OLD.role = NEW.role) AND
    (OLD.account_status = NEW.account_status) AND
    (OLD.kyc_status = NEW.kyc_status) AND
    (OLD.daily_limit = NEW.daily_limit)
  );

CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 2. Transactions Policies
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to initiate pending transactions (deposits/wires)
CREATE POLICY "Users can initiate pending transactions" ON transactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    status = 'pending'
  );

CREATE POLICY "Admins have full access to transactions" ON transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 3. User Documents Policies
CREATE POLICY "Users can manage their own documents" ON user_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents" ON user_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 4. Audit Logs Policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- 5. Messages Policies
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR receiver_id = auth.uid()::text OR receiver_id = 'admin');

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Admins can view all messages" ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 6. Admin Notes Policies
CREATE POLICY "Users can view their own admin notes" ON admin_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own admin notes" ON admin_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage admin notes" ON admin_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 7. User Notes Policies (SaaS Plan: Max 3 notes)
CREATE POLICY "Users can manage their own notes" ON notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Enforce note limit for non-admins" ON notes
  FOR INSERT WITH CHECK (
    (SELECT count(*) FROM notes WHERE user_id = auth.uid()) < 3
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 8. Notifications Policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System/Admins can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- 9. Cards Policies
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cards" ON cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" ON cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to cards" ON cards
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 10. System Settings Policies
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system settings" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage system settings" ON system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 11. Beneficiaries Table
-- Stores saved recipients for transfers
CREATE TABLE IF NOT EXISTS beneficiaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  beneficiary_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  nickname TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(user_id, beneficiary_id)
);

-- 12. Support Tickets Table
-- For structured support management
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'transaction', 'account', 'card', 'technical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 13. Wire Transfer Details Table
-- Stores specific details for wire transfers
CREATE TABLE IF NOT EXISTS wire_transfer_details (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  swift_bic TEXT NOT NULL,
  account_number TEXT NOT NULL,
  routing_number TEXT,
  recipient_address TEXT,
  bank_address TEXT,
  wire_type TEXT CHECK (wire_type IN ('domestic', 'international')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 14. Loans Table
CREATE TABLE IF NOT EXISTS loans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  interest_rate NUMERIC DEFAULT 5.5,
  term_months INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'paid', 'defaulted')),
  monthly_payment NUMERIC,
  remaining_balance NUMERIC,
  next_payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 15. Savings Goals Table
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  deadline TIMESTAMP WITH TIME ZONE,
  category TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- FUNCTIONS & RPCS (Continued)

-- G. Add Beneficiary RPC
CREATE OR REPLACE FUNCTION add_beneficiary(
  target_beneficiary_id UUID,
  target_nickname TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO beneficiaries (user_id, beneficiary_id, nickname)
  VALUES (auth.uid(), target_beneficiary_id, target_nickname)
  ON CONFLICT (user_id, beneficiary_id) DO UPDATE
  SET nickname = EXCLUDED.nickname;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- H. Get User Stats RPC (For Admin)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Security Check
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'total_balance', (SELECT COALESCE(sum(balance), 0) FROM profiles),
    'pending_transactions', (SELECT count(*) FROM transactions WHERE status = 'pending'),
    'active_cards', (SELECT count(*) FROM cards WHERE status = 'active'),
    'open_tickets', (SELECT count(*) FROM support_tickets WHERE status = 'open'),
    'total_volume_today', (SELECT COALESCE(sum(abs(amount)), 0) FROM transactions WHERE created_at >= CURRENT_DATE AND status = 'released'),
    'pending_loans', (SELECT count(*) FROM loans WHERE status = 'pending'),
    'active_loans_volume', (SELECT COALESCE(sum(amount), 0) FROM loans WHERE status = 'active'),
    'total_savings_volume', (SELECT COALESCE(sum(current_amount), 0) FROM savings_goals),
    'pending_bills_count', (SELECT count(*) FROM bill_payments WHERE status = 'scheduled'),
    'total_investments_volume', (SELECT COALESCE(sum(quantity * current_price), 0) FROM investments)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- I. Get User By Email RPC
CREATE OR REPLACE FUNCTION get_user_by_email(target_email TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.avatar_url
  FROM profiles p
  WHERE p.email = target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- J. Apply For Loan RPC
CREATE OR REPLACE FUNCTION apply_for_loan(
  loan_amount NUMERIC,
  loan_term INTEGER
) RETURNS UUID AS $$
DECLARE
  new_loan_id UUID;
BEGIN
  INSERT INTO loans (user_id, amount, term_months, status, remaining_balance)
  VALUES (auth.uid(), loan_amount, loan_term, 'pending', loan_amount)
  RETURNING id INTO new_loan_id;
  
  RETURN new_loan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS POLICIES (Continued)

ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wire_transfer_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- Loans
CREATE POLICY "Users can view their own loans" ON loans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can apply for loans" ON loans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all loans" ON loans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Savings Goals
CREATE POLICY "Users can manage their own savings goals" ON savings_goals
  FOR ALL USING (auth.uid() = user_id);

-- Support Tickets
CREATE POLICY "Users can view their own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets" ON support_tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Wire Transfer Details
CREATE POLICY "Users can view their own wire details" ON wire_transfer_details
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM transactions WHERE id = transaction_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all wire details" ON wire_transfer_details
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 16. Bill Payments Table
CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  biller_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'failed')),
  scheduled_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 17. Investments Table
CREATE TABLE IF NOT EXISTS investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC,
  asset_type TEXT CHECK (asset_type IN ('stock', 'crypto', 'bond', 'etf')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 18. Referrals Table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'joined', 'rewarded')),
  reward_amount NUMERIC DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 19. Exchange Rates Table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(from_currency, to_currency)
);

-- Insert default exchange rates
INSERT INTO exchange_rates (from_currency, to_currency, rate)
VALUES 
  ('USD', 'EUR', 0.92),
  ('EUR', 'USD', 1.09),
  ('USD', 'GBP', 0.79),
  ('GBP', 'USD', 1.27),
  ('USD', 'JPY', 151.42),
  ('JPY', 'USD', 0.0066)
ON CONFLICT (from_currency, to_currency) DO UPDATE SET rate = EXCLUDED.rate;

-- FUNCTIONS & RPCS (Continued)

-- 18. Loan Repayments Table
CREATE TABLE IF NOT EXISTS loan_repayments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own repayments" ON loan_repayments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all repayments" ON loan_repayments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- K. Repay Loan RPC
CREATE OR REPLACE FUNCTION repay_loan(
  target_loan_id UUID,
  repayment_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  current_user_balance NUMERIC;
  loan_balance NUMERIC;
BEGIN
  -- Security Check
  IF NOT EXISTS (SELECT 1 FROM loans WHERE id = target_loan_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get balances
  SELECT balance INTO current_user_balance FROM profiles WHERE id = auth.uid();
  SELECT remaining_balance INTO loan_balance FROM loans WHERE id = target_loan_id;

  -- Validation
  IF repayment_amount <= 0 THEN
    RAISE EXCEPTION 'Repayment amount must be positive';
  END IF;

  IF current_user_balance < repayment_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Atomic Transaction
  -- 1. Debit User
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (auth.uid(), -repayment_amount, 'released', 'Loan Repayment');

  -- 2. Update Loan
  UPDATE loans
  SET remaining_balance = remaining_balance - repayment_amount,
      status = CASE WHEN remaining_balance - repayment_amount <= 0 THEN 'paid' ELSE status END,
      updated_at = NOW()
  WHERE id = target_loan_id;

  -- 3. Log Repayment
  INSERT INTO loan_repayments (loan_id, user_id, amount)
  VALUES (target_loan_id, auth.uid(), repayment_amount);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- L. Contribute to Savings Goal RPC
CREATE OR REPLACE FUNCTION contribute_to_savings(
  target_goal_id UUID,
  contribution_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  current_user_balance NUMERIC;
BEGIN
  -- Security Check
  IF NOT EXISTS (SELECT 1 FROM savings_goals WHERE id = target_goal_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get balance
  SELECT balance INTO current_user_balance FROM profiles WHERE id = auth.uid();

  -- Validation
  IF contribution_amount <= 0 THEN
    RAISE EXCEPTION 'Contribution amount must be positive';
  END IF;

  IF current_user_balance < contribution_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Atomic Transaction
  -- 1. Debit User
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (auth.uid(), -contribution_amount, 'released', 'Savings Goal Contribution');

  -- 2. Update Goal
  UPDATE savings_goals
  SET current_amount = current_amount + contribution_amount,
      is_completed = CASE WHEN current_amount + contribution_amount >= target_amount THEN TRUE ELSE FALSE END,
      updated_at = NOW()
  WHERE id = target_goal_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- M. Pay Bill RPC
CREATE OR REPLACE FUNCTION pay_bill(
  target_bill_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  current_user_balance NUMERIC;
  bill_amount NUMERIC;
  biller TEXT;
BEGIN
  -- Security Check
  IF NOT EXISTS (SELECT 1 FROM bill_payments WHERE id = target_bill_id AND user_id = auth.uid() AND status IN ('pending', 'scheduled')) THEN
    RAISE EXCEPTION 'Unauthorized or bill already paid';
  END IF;

  -- Get data
  SELECT balance INTO current_user_balance FROM profiles WHERE id = auth.uid();
  SELECT amount, biller_name INTO bill_amount, biller FROM bill_payments WHERE id = target_bill_id;

  -- Validation
  IF current_user_balance < bill_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Atomic Transaction
  -- 1. Debit User
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (auth.uid(), -bill_amount, 'released', 'Bill Payment: ' || biller);

  -- 2. Update Bill
  UPDATE bill_payments
  SET status = 'completed'
  WHERE id = target_bill_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- N. Buy Investment RPC
CREATE OR REPLACE FUNCTION buy_investment(
  asset_name TEXT,
  asset_symbol TEXT,
  quantity NUMERIC,
  price NUMERIC,
  asset_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  current_user_balance NUMERIC;
  total_cost NUMERIC;
BEGIN
  total_cost := quantity * price;

  -- Get balance
  SELECT balance INTO current_user_balance FROM profiles WHERE id = auth.uid();

  -- Validation
  IF current_user_balance < total_cost THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Atomic Transaction
  -- 1. Debit User
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (auth.uid(), -total_cost, 'released', 'Investment Purchase: ' || asset_symbol);

  -- 2. Update/Insert Investment
  IF EXISTS (SELECT 1 FROM investments WHERE user_id = auth.uid() AND asset_symbol = buy_investment.asset_symbol) THEN
    UPDATE investments
    SET 
      average_price = (average_price * quantity + total_cost) / (quantity + buy_investment.quantity),
      quantity = quantity + buy_investment.quantity,
      updated_at = NOW()
    WHERE user_id = auth.uid() AND asset_symbol = buy_investment.asset_symbol;
  ELSE
    INSERT INTO investments (user_id, asset_name, asset_symbol, quantity, average_price, current_price, asset_type)
    VALUES (auth.uid(), asset_name, asset_symbol, quantity, price, price, asset_type);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- O. Sell Investment RPC
CREATE OR REPLACE FUNCTION sell_investment(
  target_investment_id UUID,
  sell_quantity NUMERIC,
  sell_price NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  current_quantity NUMERIC;
  total_gain NUMERIC;
  symbol TEXT;
BEGIN
  -- Security Check
  IF NOT EXISTS (SELECT 1 FROM investments WHERE id = target_investment_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get data
  SELECT quantity, asset_symbol INTO current_quantity, symbol FROM investments WHERE id = target_investment_id;

  -- Validation
  IF current_quantity < sell_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity';
  END IF;

  total_gain := sell_quantity * sell_price;

  -- Atomic Transaction
  -- 1. Credit User
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (auth.uid(), total_gain, 'released', 'Investment Sale: ' || symbol);

  -- 2. Update Investment
  IF current_quantity = sell_quantity THEN
    DELETE FROM investments WHERE id = target_investment_id;
  ELSE
    UPDATE investments
    SET 
      quantity = quantity - sell_quantity,
      updated_at = NOW()
    WHERE id = target_investment_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- P. Admin Update Investment Price RPC
CREATE OR REPLACE FUNCTION admin_update_investment_price(
  target_symbol TEXT,
  new_price NUMERIC
) RETURNS VOID AS $$
BEGIN
  -- Check if admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  UPDATE investments
  SET current_price = new_price,
      updated_at = NOW()
  WHERE asset_symbol = target_symbol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Q. Admin Pay Bill RPC
CREATE OR REPLACE FUNCTION admin_pay_bill(
  target_bill_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  target_user_id UUID;
  current_user_balance NUMERIC;
  bill_amount NUMERIC;
  biller TEXT;
  is_admin_user BOOLEAN;
BEGIN
  -- Security Check: Only admins can call this
  SELECT is_admin INTO is_admin_user FROM profiles WHERE id = auth.uid();
  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can process bills';
  END IF;

  -- Get data
  SELECT user_id, amount, biller_name INTO target_user_id, bill_amount, biller 
  FROM bill_payments WHERE id = target_bill_id;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  -- Get user balance
  SELECT balance INTO current_user_balance FROM profiles WHERE id = target_user_id;

  -- Validation
  IF current_user_balance < bill_amount THEN
    RAISE EXCEPTION 'Insufficient funds in user account';
  END IF;

  -- Atomic Transaction
  -- 1. Debit User
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (target_user_id, -bill_amount, 'released', 'Bill Payment (Admin Processed): ' || biller);

  -- 2. Update Bill
  UPDATE bill_payments
  SET status = 'completed'
  WHERE id = target_bill_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Q. Admin Adjust Balance RPC
CREATE OR REPLACE FUNCTION admin_adjust_balance(
  target_user_id UUID,
  amount NUMERIC,
  description TEXT,
  balance_type TEXT -- 'checking', 'savings', 'loan', 'investment'
) RETURNS BOOLEAN AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  -- Security Check: Only admins can call this
  SELECT is_admin INTO is_admin_user FROM profiles WHERE id = auth.uid();
  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can adjust balances';
  END IF;

  -- Insert transaction record
  -- The trigger 'on_transaction_change' will automatically update the appropriate balance in profiles
  INSERT INTO transactions (user_id, amount, status, description, type, balance_type)
  VALUES (target_user_id, amount, 'released', description, CASE WHEN amount >= 0 THEN 'credit' ELSE 'debit' END, balance_type);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- R. Admin Set Balance RPC
CREATE OR REPLACE FUNCTION admin_set_balance(
  target_user_id UUID,
  new_balance NUMERIC,
  balance_type TEXT -- 'checking', 'savings', 'loan', 'investment'
) RETURNS BOOLEAN AS $$
DECLARE
  is_admin_user BOOLEAN;
  old_balance NUMERIC;
  diff NUMERIC;
BEGIN
  -- Security Check: Only admins can call this
  SELECT is_admin INTO is_admin_user FROM profiles WHERE id = auth.uid();
  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can set balances';
  END IF;

  -- Get old balance
  IF balance_type = 'checking' THEN
    SELECT balance INTO old_balance FROM profiles WHERE id = target_user_id;
  ELSIF balance_type = 'savings' THEN
    SELECT COALESCE(savings_balance, 0) INTO old_balance FROM profiles WHERE id = target_user_id;
  ELSIF balance_type = 'loan' THEN
    SELECT COALESCE(loan_balance, 0) INTO old_balance FROM profiles WHERE id = target_user_id;
  ELSIF balance_type = 'investment' THEN
    SELECT COALESCE(investment_balance, 0) INTO old_balance FROM profiles WHERE id = target_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid balance type';
  END IF;

  diff := new_balance - old_balance;

  -- Insert transaction record for the difference
  -- The trigger 'on_transaction_change' will automatically update the appropriate balance in profiles
  IF diff <> 0 THEN
    INSERT INTO transactions (user_id, amount, status, description, type, balance_type)
    VALUES (target_user_id, diff, 'released', 'Admin Balance Correction (' || balance_type || ')', CASE WHEN diff >= 0 THEN 'credit' ELSE 'debit' END, balance_type);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS POLICIES (Continued)

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Bill Payments
CREATE POLICY "Users can manage their own bill payments" ON bill_payments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to bill payments" ON bill_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Investments
CREATE POLICY "Users can manage their own investments" ON investments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all investments" ON investments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Referrals
CREATE POLICY "Users can view their own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can create referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- Exchange Rates
CREATE POLICY "Anyone can view exchange rates" ON exchange_rates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage exchange rates" ON exchange_rates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 10. Admin Grant (Seed/Setup)
-- Run this in Supabase SQL Editor to grant admin privileges to your account
-- UPDATE profiles SET is_admin = true, role = 'admin' WHERE email = 'ositalan5@gmail.com';
