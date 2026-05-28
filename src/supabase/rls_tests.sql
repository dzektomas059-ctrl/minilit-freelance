-- pgTAP tests for MiniLIT RLS policies
-- Run with: pg_prove -U postgres -d minilit tests/rls_tests.sql
-- Or in Supabase SQL editor: SELECT * FROM run_tests();

BEGIN;

SELECT plan(20);

-- Test setup: create test users
\set client_id '00000000-0000-0000-0000-000000000001'
\set freelancer_id '00000000-0000-0000-0000-000000000002'
\set other_id '00000000-0000-0000-0000-000000000003'
\set admin_id '00000000-0000-0000-0000-000000000004'

-- Insert test profiles
INSERT INTO auth.users (id, email) VALUES
  (:client_id, 'client@test.com'),
  (:freelancer_id, 'freelancer@test.com'),
  (:other_id, 'other@test.com'),
  (:admin_id, 'admin@test.com');

INSERT INTO public.profiles (id, email, name, role, is_admin) VALUES
  (:client_id, 'client@test.com', 'Test Client', 'client', false),
  (:freelancer_id, 'freelancer@test.com', 'Test Freelancer', 'freelancer', false),
  (:other_id, 'other@test.com', 'Other User', 'client', false),
  (:admin_id, 'admin@test.com', 'Admin User', 'client', true);

-- Set up auth context helpers (requires pgJWT or similar)
-- These tests assume we can set auth.uid() via session variables

-- Test 1: User can read own profile
SELECT is(
  (SELECT COUNT(*) FROM public.profiles WHERE id = :client_id),
  1::bigint,
  'Client can read own profile'
);

-- Test 2: User cannot read balance of other users (via public_profiles view)
SELECT is(
  (SELECT COUNT(*) FROM public.profiles WHERE id = :freelancer_id),
  1::bigint,
  'Client can read other basic profile info (name, role)'
);

-- Test 3: User cannot update other user profile
-- This should fail RLS
-- UPDATE public.profiles SET name = 'Hacked' WHERE id = :other_id;
-- The RLS should prevent this; we need a way to assert it

-- Test 4: Only admin can update is_admin flag
-- UPDATE public.profiles SET is_admin = true WHERE id = :client_id;
-- Should fail RLS

-- Test 5: Job creator can read own job
INSERT INTO public.jobs (id, client_id, title, description, category, budget, status)
VALUES ('job-001', :client_id, 'Test Job', 'Test', 'dev', 1000, 'open');
SELECT is(
  (SELECT COUNT(*) FROM public.jobs WHERE id = 'job-001'),
  1::bigint,
  'Authorized user can read job'
);

-- Test 6: Other user can read open jobs
SELECT is(
  (SELECT COUNT(*) FROM public.jobs WHERE status = 'open'),
  1::bigint,
  'All users can read open jobs'
);

-- Test 7: Only job creator can update job
-- UPDATE public.jobs SET title = 'Updated' WHERE id = 'job-001';
-- Should succeed as :client_id, fail as :other_id

-- Test 8: Freelancer can apply to job
INSERT INTO public.applications (id, job_id, freelancer_id, message)
VALUES ('app-001', 'job-001', :freelancer_id, 'I can help');
SELECT is(
  (SELECT COUNT(*) FROM public.applications WHERE id = 'app-001'),
  1::bigint,
  'Freelancer can create application'
);

-- Test 9: Only job client and applicant can see the application
-- Assert: client sees it, freelancer sees it, other user does not

-- Test 10: Chat participants can read messages
INSERT INTO public.chats (id, client_id, freelancer_id)
VALUES ('chat-001', :client_id, :freelancer_id);
INSERT INTO public.messages (id, chat_id, sender_id, text)
VALUES ('msg-001', 'chat-001', :client_id, 'Hello');
SELECT is(
  (SELECT COUNT(*) FROM public.messages WHERE id = 'msg-001'),
  1::bigint,
  'Chat participant can read message'
);

-- Test 11: Non-participant cannot read chat messages
-- Assert: :other_id cannot SELECT from messages WHERE chat_id = 'chat-001'

-- Test 12: User can only see own notifications
INSERT INTO public.notifications (id, user_id, type, title, body)
VALUES ('notif-001', :client_id, 'system', 'Test', 'Body');
SELECT is(
  (SELECT COUNT(*) FROM public.notifications WHERE id = 'notif-001'),
  1::bigint,
  'User can read own notification'
);

-- Test 13: User cannot see others notifications
-- Assert: :freelancer_id cannot see notif-001

-- Test 14: Only order participants can read order
INSERT INTO public.orders (id, client_id, freelancer_id, service_id, price, title, status)
VALUES ('order-001', :client_id, :freelancer_id, 'svc-001', 100, 'Test Order', 'pending_payment');
SELECT is(
  (SELECT COUNT(*) FROM public.orders WHERE id = 'order-001'),
  1::bigint,
  'Participant can read order'
);

-- Test 15: Non-participant cannot read order
-- Assert: :other_id cannot see order-001

-- Test 16: Admin can read all orders
-- Assert: :admin_id can see order-001

-- Test 17: User can only write own bookmarks
INSERT INTO public.bookmarks (id, user_id, target_type, target_id)
VALUES ('bm-001', :client_id, 'job', 'job-001');
SELECT is(
  (SELECT COUNT(*) FROM public.bookmarks WHERE id = 'bm-001'),
  1::bigint,
  'User can create own bookmark'
);

-- Test 18: User cannot modify others bookmarks
-- Assert: :freelancer_id cannot delete bm-001

-- Test 19: Only admin can read complaints
INSERT INTO public.complaints (id, complainant_id, target_type, target_id, reason)
VALUES ('comp-001', :client_id, 'user', :freelancer_id, 'Spam');
-- Assert: only admin can read comp-001

-- Test 20: public_profiles view hides sensitive fields
SELECT columns_are(
  'public', 'public_profiles',
  ARRAY['id', 'email', 'name', 'role', 'bio', 'specialization', 'avatar_url',
        'cover_url', 'rating', 'reviews_count', 'orders_done', 'orders_total',
        'connects_remaining', 'last_seen', 'notif_prefs', 'created_at'],
  'public_profiles view has correct columns (no balance/is_admin)'
);

-- Cleanup
DELETE FROM public.bookmarks WHERE id = 'bm-001';
DELETE FROM public.complaints WHERE id = 'comp-001';
DELETE FROM public.orders WHERE id = 'order-001';
DELETE FROM public.notifications WHERE id = 'notif-001';
DELETE FROM public.messages WHERE id = 'msg-001';
DELETE FROM public.chats WHERE id = 'chat-001';
DELETE FROM public.applications WHERE id = 'app-001';
DELETE FROM public.jobs WHERE id = 'job-001';
DELETE FROM public.profiles WHERE id IN (:client_id, :freelancer_id, :other_id, :admin_id);
DELETE FROM auth.users WHERE id IN (:client_id, :freelancer_id, :other_id, :admin_id);

SELECT * FROM finish();
ROLLBACK;
