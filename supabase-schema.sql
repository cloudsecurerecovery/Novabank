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
  is_admin BOOLEAN DEFAULT FALSE,
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
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'hold', 'released', 'failed', 'reversible')),
  description TEXT,
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

-- FUNCTIONS & RPCS

-- A. Transfer Funds RPC
-- Handles atomic transfers between two users
CREATE OR REPLACE FUNCTION transfer_funds(
  sender_id UUID,
  receiver_id UUID,
  transfer_amount NUMERIC,
  sender_description TEXT,
  receiver_description TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  sender_balance NUMERIC;
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

  -- Calculate sender balance (only released transactions)
  SELECT COALESCE(SUM(amount), 0) INTO sender_balance
  FROM transactions
  WHERE user_id = sender_id AND status = 'released';

  -- Check sufficient funds
  IF sender_balance < transfer_amount THEN
    RAISE EXCEPTION 'Insufficient funds: Your available balance is %', sender_balance;
  END IF;

  -- Atomic Transaction: Debit Sender
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (sender_id, -transfer_amount, 'released', sender_description);

  -- Atomic Transaction: Credit Receiver
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (receiver_id, transfer_amount, 'released', receiver_description);

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. OTP Generation RPC
-- Generates a 6-digit OTP and stores it in the profile
CREATE OR REPLACE FUNCTION generate_otp(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  new_otp TEXT;
  is_admin_user BOOLEAN;
BEGIN
  -- Security Check: Allow self or admin
  SELECT is_admin INTO is_admin_user FROM profiles WHERE id = auth.uid();
  
  IF target_user_id != auth.uid() AND (is_admin_user IS NULL OR NOT is_admin_user) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Generate 6-digit code
  new_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  UPDATE profiles
  SET otp_code = new_otp,
      otp_expires_at = NOW() + INTERVAL '10 minutes'
  WHERE id = target_user_id;
  
  RETURN new_otp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. OTP Verification RPC
-- Verifies the OTP and clears it upon success
CREATE OR REPLACE FUNCTION verify_otp(target_user_id UUID, input_otp TEXT)
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
  FROM profiles
  WHERE id = target_user_id;

  -- Validation
  IF stored_otp IS NULL OR stored_otp != input_otp THEN
    RETURN FALSE;
  END IF;

  IF expires_at < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Success: Clear OTP
  UPDATE profiles
  SET otp_code = NULL, otp_expires_at = NULL
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. New User Profile Trigger
-- Automatically creates a profile entry when a new user signs up via Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, is_admin)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    -- First user ever could be admin, or just default to false
    FALSE
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
  INSERT INTO transactions (user_id, amount, status, description)
  SELECT id, deposit_amount, 'released', deposit_description
  FROM profiles;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Re-create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

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
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 2. Transactions Policies
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

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
