
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- User resources table
CREATE TABLE public.user_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ram INTEGER NOT NULL DEFAULT 1024,
  cpu INTEGER NOT NULL DEFAULT 100,
  disk INTEGER NOT NULL DEFAULT 5120,
  server_slots INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resources" ON public.user_resources FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own resources" ON public.user_resources FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Servers table
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  server_type TEXT NOT NULL,
  pterodactyl_id TEXT,
  ram INTEGER NOT NULL DEFAULT 1024,
  cpu INTEGER NOT NULL DEFAULT 100,
  disk INTEGER NOT NULL DEFAULT 5120,
  status TEXT NOT NULL DEFAULT 'installing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own servers" ON public.servers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own servers" ON public.servers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own servers" ON public.servers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Coupons table (admin managed)
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  coins_reward INTEGER NOT NULL DEFAULT 0,
  ram_reward INTEGER NOT NULL DEFAULT 0,
  cpu_reward INTEGER NOT NULL DEFAULT 0,
  disk_reward INTEGER NOT NULL DEFAULT 0,
  slots_reward INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active coupons" ON public.coupons FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Coupon claims table
CREATE TABLE public.coupon_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE CASCADE NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, coupon_id)
);

ALTER TABLE public.coupon_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims" ON public.coupon_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own claims" ON public.coupon_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  coins_change INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Settings table (admin only)
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile and resources on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_resources (user_id)
  VALUES (NEW.id);
  
  -- Give starting coins
  UPDATE public.profiles SET coins = 100 WHERE id = NEW.id;
  
  INSERT INTO public.transactions (user_id, type, description, coins_change)
  VALUES (NEW.id, 'signup_bonus', 'Welcome bonus coins', 100);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('default_resources', '{"ram": 1024, "cpu": 100, "disk": 5120, "server_slots": 1, "starting_coins": 100}'::jsonb),
  ('pterodactyl_url', '""'::jsonb);
