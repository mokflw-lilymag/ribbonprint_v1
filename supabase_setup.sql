-- ============================================================
-- RibbonPrint SaaS - 통합 DB 설정 (이 파일 하나만 실행하세요)
-- ============================================================

-- ★ 1단계: 기존 테이블 안전 정리
DROP TABLE IF EXISTS public.print_history CASCADE;
DROP TABLE IF EXISTS public.custom_fonts CASCADE;
DROP TABLE IF EXISTS public.custom_fonts_old CASCADE;
DROP TABLE IF EXISTS public.custom_phrases CASCADE;
DROP TABLE IF EXISTS public.custom_phrases_old CASCADE;
DROP TABLE IF EXISTS public.templates CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ★ 2단계: 테이블 생성
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.custom_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.custom_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  font_family TEXT NOT NULL,
  source TEXT NOT NULL,
  web_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ribbon_type TEXT,
  width INTEGER,
  length INTEGER,
  left_text TEXT,
  right_text TEXT,
  printer_name TEXT,
  thumbnail_url TEXT,
  printed_at TIMESTAMPTZ DEFAULT now()
);

-- ★ 3단계: RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fonts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_history ENABLE ROW LEVEL SECURITY;

-- ★ 4단계: RLS 정책
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates_select_own" ON public.templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates_insert_own" ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates_update_own" ON public.templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "templates_delete_own" ON public.templates FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "phrases_select_own" ON public.custom_phrases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "phrases_insert_own" ON public.custom_phrases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "phrases_update_own" ON public.custom_phrases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "phrases_delete_own" ON public.custom_phrases FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "fonts_select_own" ON public.custom_fonts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fonts_insert_own" ON public.custom_fonts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fonts_update_own" ON public.custom_fonts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fonts_delete_own" ON public.custom_fonts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "history_select_own" ON public.print_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "history_insert_own" ON public.print_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_profiles_all" ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_subscriptions_all" ON public.subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "admin_print_history_all" ON public.print_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
