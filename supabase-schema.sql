-- Run this in Supabase SQL Editor

-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Transactions Table
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC,
  status TEXT CHECK (status IN ('pending', 'hold', 'released', 'reversible')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Messages (Chat) Table
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id),
  receiver_id UUID, -- 'admin' or user_id
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Admin Notes Table
CREATE TABLE admin_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. User Notes Table (SaaS Plan: Max 3 notes for free users)
CREATE TABLE notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Transfer Funds Function (RPC)
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
  -- Check if sender is the authenticated user
  IF sender_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Check if amount is positive
  IF transfer_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  -- Calculate sender balance (only released transactions)
  SELECT COALESCE(SUM(amount), 0) INTO sender_balance
  FROM transactions
  WHERE user_id = sender_id AND status = 'released';

  -- Check sufficient funds
  IF sender_balance < transfer_amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Insert sender transaction (debit)
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (sender_id, -transfer_amount, 'pending', sender_description);

  -- Insert receiver transaction (credit)
  INSERT INTO transactions (user_id, amount, status, description)
  VALUES (receiver_id, transfer_amount, 'pending', receiver_description);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Transactions Policies
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all transactions" ON transactions FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can insert transactions" ON transactions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can update transactions" ON transactions FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Messages Policies
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Admins can view all messages" ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can insert messages" ON messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Admin Notes Policies
CREATE POLICY "Users can view own notes" ON admin_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON admin_notes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage notes" ON admin_notes FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- User Notes Policies (SaaS Limit: 3)
CREATE POLICY "Users can view own user notes" ON notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user notes" ON notes FOR INSERT WITH CHECK (
  auth.uid() = user_id AND 
  (SELECT count(*) FROM notes WHERE user_id = auth.uid()) < 3
);
CREATE POLICY "Users can update own user notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own user notes" ON notes FOR DELETE USING (auth.uid() = user_id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
