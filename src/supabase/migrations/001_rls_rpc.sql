-- ============================================================================
-- Migration 001: RLS Policies, RPC Functions, and Triggers for MiniLIT
-- ============================================================================

-- ############################################################################
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ############################################################################

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;

-- ############################################################################
-- 2. RLS POLICIES
-- ############################################################################

-- --------------------------------------------------------------------------
-- PROFILES
-- --------------------------------------------------------------------------
-- Users can CRUD their own profile; all authenticated users can SELECT; UPDATE only own row
CREATE POLICY "profiles_select_all_authenticated"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- --------------------------------------------------------------------------
-- JOBS (tasks)
-- --------------------------------------------------------------------------
-- SELECT for all authenticated; INSERT / UPDATE / DELETE only by client_id
CREATE POLICY "jobs_select_all_authenticated"
  ON jobs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "jobs_insert_own"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "jobs_update_own"
  ON jobs FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "jobs_delete_own"
  ON jobs FOR DELETE
  USING (auth.uid() = client_id);

-- --------------------------------------------------------------------------
-- SERVICES
-- --------------------------------------------------------------------------
-- SELECT for all authenticated; INSERT / UPDATE / DELETE only by freelancer_id
CREATE POLICY "services_select_all_authenticated"
  ON services FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "services_insert_own"
  ON services FOR INSERT
  WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "services_update_own"
  ON services FOR UPDATE
  USING (auth.uid() = freelancer_id)
  WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "services_delete_own"
  ON services FOR DELETE
  USING (auth.uid() = freelancer_id);

-- --------------------------------------------------------------------------
-- ORDERS
-- --------------------------------------------------------------------------
-- SELECT for participants (client or freelancer) or admin; UPDATE for participants only
CREATE POLICY "orders_select_participants_or_admin"
  ON orders FOR SELECT
  USING (
    auth.uid() = client_id
    OR auth.uid() = freelancer_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "orders_update_participants"
  ON orders FOR UPDATE
  USING (
    auth.uid() = client_id
    OR auth.uid() = freelancer_id
  )
  WITH CHECK (
    auth.uid() = client_id
    OR auth.uid() = freelancer_id
  );

-- --------------------------------------------------------------------------
-- APPLICATIONS
-- --------------------------------------------------------------------------
-- INSERT by any freelancer; SELECT by applicant or the job's client
CREATE POLICY "applications_insert_freelancer"
  ON applications FOR INSERT
  WITH CHECK (
    auth.uid() = freelancer_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'freelancer')
  );

CREATE POLICY "applications_select_applicant_or_client"
  ON applications FOR SELECT
  USING (
    auth.uid() = freelancer_id
    OR auth.uid() IN (
      SELECT client_id FROM jobs WHERE jobs.id = applications.job_id
    )
  );

-- --------------------------------------------------------------------------
-- CHATS
-- --------------------------------------------------------------------------
-- SELECT / INSERT if user is participant
CREATE POLICY "chats_select_participant"
  ON chats FOR SELECT
  USING (
    auth.uid() = client_id
    OR auth.uid() = freelancer_id
  );

CREATE POLICY "chats_insert_participant"
  ON chats FOR INSERT
  WITH CHECK (
    auth.uid() = client_id
    OR auth.uid() = freelancer_id
  );

-- --------------------------------------------------------------------------
-- MESSAGES
-- --------------------------------------------------------------------------
-- SELECT / INSERT if user is in the chat
CREATE POLICY "messages_select_in_chat"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (chats.client_id = auth.uid() OR chats.freelancer_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_in_chat"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND (chats.client_id = auth.uid() OR chats.freelancer_id = auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- NOTIFICATIONS
-- --------------------------------------------------------------------------
-- SELECT / UPDATE only by user_id; INSERT by any authenticated (with user_id check)
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_authenticated"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- BOOKMARKS
-- --------------------------------------------------------------------------
-- CRUD only own
CREATE POLICY "bookmarks_select_own"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "bookmarks_insert_own"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_update_own"
  ON bookmarks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_delete_own"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- REVIEWS
-- --------------------------------------------------------------------------
-- SELECT for all authenticated; INSERT by order participants
CREATE POLICY "reviews_select_all_authenticated"
  ON reviews FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reviews_insert_participants"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = reviews.order_id
      AND (orders.client_id = auth.uid() OR orders.freelancer_id = auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- COMPLAINTS
-- --------------------------------------------------------------------------
-- INSERT if authenticated; SELECT / UPDATE only by admin
CREATE POLICY "complaints_insert_authenticated"
  ON complaints FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "complaints_select_admin"
  ON complaints FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "complaints_update_admin"
  ON complaints FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- --------------------------------------------------------------------------
-- TRANSACTIONS
-- --------------------------------------------------------------------------
-- SELECT by participant
CREATE POLICY "transactions_select_participant"
  ON transactions FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = recipient_id
  );

-- ############################################################################
-- 3. RPC FUNCTIONS (PL/pgSQL)
-- ############################################################################

-- --------------------------------------------------------------------------
-- spend_connect
-- Decrements connects_remaining, raises exception if insufficient funds.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION spend_connect(user_id UUID, amount INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET connects_remaining = connects_remaining - amount
  WHERE id = user_id
    AND connects_remaining >= amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient connects. User % has insufficient or no connecting balance.', user_id;
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- claim_quest_reward
-- Checks quest_rewards table for duplicate claim, inserts row,
-- updates connects_remaining atomically.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_quest_reward(user_id UUID, quest_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reward_amount INT;
  existing_id UUID;
BEGIN
  -- Check for duplicate claim
  SELECT id INTO existing_id
  FROM quest_rewards
  WHERE user_id = claim_quest_reward.user_id
    AND quest_id = claim_quest_reward.quest_id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Quest % has already been claimed by user %.', quest_id, user_id;
  END IF;

  -- Determine reward amount (default 10 connects per quest)
  reward_amount := 10;

  -- Insert reward record
  INSERT INTO quest_rewards (user_id, quest_id, reward_amount)
  VALUES (user_id, quest_id, reward_amount);

  -- Atomically credit connects
  UPDATE profiles
  SET connects_remaining = connects_remaining + reward_amount
  WHERE id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %. Rolling back quest reward claim.', user_id;
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- escrow_pay
-- Transfers balance from client to freelancer, updates order to 'completed'.
-- Uses BEGIN / EXCEPTION / END with rollback on failure.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION escrow_pay(order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _client_id UUID;
  _freelancer_id UUID;
  _amount NUMERIC;
BEGIN
  -- Lock and read the order row
  SELECT client_id, freelancer_id, amount INTO STRICT _client_id, _freelancer_id, _amount
  FROM orders
  WHERE id = order_id
    AND status = 'in_progress'
  FOR UPDATE;

  -- Deduct from client balance
  UPDATE profiles
  SET balance = balance - _amount
  WHERE id = _client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client profile not found for order %.', order_id;
  END IF;

  -- Add to freelancer balance
  UPDATE profiles
  SET balance = balance + _amount
  WHERE id = _freelancer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freelancer profile not found for order %.', order_id;
  END IF;

  -- Mark order completed
  UPDATE orders
  SET status = 'completed', updated_at = NOW()
  WHERE id = order_id;

  -- Record transaction
  INSERT INTO transactions (sender_id, recipient_id, order_id, amount, type)
  VALUES (_client_id, _freelancer_id, order_id, _amount, 'escrow_release');

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- --------------------------------------------------------------------------
-- escrow_refund
-- Returns escrow amount back to client, sets order to 'cancelled'.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION escrow_refund(order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _client_id UUID;
  _freelancer_id UUID;
  _amount NUMERIC;
BEGIN
  SELECT client_id, freelancer_id, amount INTO STRICT _client_id, _freelancer_id, _amount
  FROM orders
  WHERE id = order_id
    AND status = 'in_progress'
  FOR UPDATE;

  -- Return full amount to client
  UPDATE profiles
  SET balance = balance + _amount
  WHERE id = _client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client profile not found for refund on order %.', order_id;
  END IF;

  -- Mark order cancelled
  UPDATE orders
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = order_id;

  -- Record transaction
  INSERT INTO transactions (sender_id, recipient_id, order_id, amount, type)
  VALUES (_freelancer_id, _client_id, order_id, _amount, 'escrow_refund');

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- --------------------------------------------------------------------------
-- auto_escrow_release (TRIGGER FUNCTION)
-- On order status change to 'completed' or 'cancelled', calls escrow_pay
-- or escrow_refund automatically.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_escrow_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
    PERFORM escrow_pay(NEW.id);
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'in_progress' THEN
    PERFORM escrow_refund(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- get_public_profile
-- Returns profile without sensitive fields (balance, is_admin, email, banned,
-- payment_details). Uses public_profiles view.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_public_profile(user_id UUID)
RETURNS SETOF public_profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public_profiles
  WHERE id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public profile not found for user %.', user_id;
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- create_public_profiles_view
-- Creates a secure view public_profiles that excludes sensitive columns.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_public_profiles_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DROP VIEW IF EXISTS public_profiles CASCADE;

  EXECUTE FORMAT(
    'CREATE VIEW public_profiles AS
     SELECT
       id,
       username,
       full_name,
       avatar_url,
       cover_url,
       bio,
       role,
       skills,
       hourly_rate,
       rating,
       review_count,
       job_count,
       location,
       created_at,
       updated_at
     FROM profiles'
  );
END;
$$;

-- ############################################################################
-- 4. TRIGGERS
-- ############################################################################

-- --------------------------------------------------------------------------
-- auto_escrow_release trigger on orders AFTER UPDATE of status
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auto_escrow_release ON orders;

CREATE TRIGGER trg_auto_escrow_release
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'cancelled'))
  EXECUTE FUNCTION auto_escrow_release();

-- --------------------------------------------------------------------------
-- handle_new_user trigger
-- On auth.users INSERT, creates a profile row with default role 'client'
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'client'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user ON auth.users;

CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
