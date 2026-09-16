/*
# Create price_alerts table for FlightIQ tracked deals

1. New Tables
- `price_alerts`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to the authenticated user, references auth.users with cascade delete)
  - `origin` (text, not null) — IATA code of departure airport
  - `destination` (text, not null) — IATA code of arrival airport
  - `route_label` (text, not null) — human-readable "ORG → DST" for display
  - `target_price_usd` (numeric, not null) — price threshold in USD
  - `channel` (text, not null, default 'email') — notification channel: 'email' or 'telegram'
  - `email` (text, nullable) — email address for email alerts
  - `telegram_chat_id` (text, nullable) — Telegram chat ID for telegram alerts
  - `last_checked_at` (timestamptz, nullable) — last time the alert was checked
  - `last_price_usd` (numeric, nullable) — last observed price
  - `is_active` (boolean, not null, default true) — whether the alert is still active
  - `created_at` (timestamptz, default now)

2. Security
- Enable RLS on `price_alerts`.
- Owner-scoped CRUD: each authenticated user can only access their own alerts.
- SELECT, INSERT, UPDATE, DELETE policies scoped to `auth.uid() = user_id`.
- The `user_id` column defaults to `auth.uid()` so inserts that omit it still satisfy the WITH CHECK.

3. Important Notes
- This is a multi-user app (sign-in required for tracked deals).
- The anon-key client cannot read or write this table — only authenticated users.
- Frontend inserts will omit `user_id`; the DEFAULT auth.uid() fills it.
*/

CREATE TABLE IF NOT EXISTS price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  origin text NOT NULL,
  destination text NOT NULL,
  route_label text NOT NULL,
  target_price_usd numeric NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'telegram')),
  email text,
  telegram_chat_id text,
  last_checked_at timestamptz,
  last_price_usd numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_alerts" ON price_alerts;
CREATE POLICY "select_own_alerts" ON price_alerts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_alerts" ON price_alerts;
CREATE POLICY "insert_own_alerts" ON price_alerts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_alerts" ON price_alerts;
CREATE POLICY "update_own_alerts" ON price_alerts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_alerts" ON price_alerts;
CREATE POLICY "delete_own_alerts" ON price_alerts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;
