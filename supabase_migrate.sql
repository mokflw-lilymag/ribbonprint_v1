-- ============================================================
-- RibbonPrint SaaS - Migration Script
-- 기존 테이블이 있는 상태에서 SaaS 스키마로 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행해주세요
-- ============================================================

-- ★ STEP 1: 기존 custom_phrases 테이블 백업 후 새로 생성
-- 기존 테이블에 user_id가 없으므로, 기존 데이터를 보존하면서 재생성합니다

-- 1-1. 기존 custom_phrases 백업
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_phrases') THEN
    -- 기존 RLS 정책 제거 (있다면)
    DROP POLICY IF EXISTS "phrases_select_own" ON public.custom_phrases;
    DROP POLICY IF EXISTS "phrases_insert_own" ON public.custom_phrases;
    DROP POLICY IF EXISTS "phrases_update_own" ON public.custom_phrases;
    DROP POLICY IF EXISTS "phrases_delete_own" ON public.custom_phrases;
    
    -- 기존 테이블 이름 변경 (백업)
    ALTER TABLE public.custom_phrases RENAME TO custom_phrases_old;
  END IF;
END $$;

-- 1-2. 기존 custom_fonts 백업 (만약 있다면)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_fonts') THEN
    DROP POLICY IF EXISTS "fonts_select_own" ON public.custom_fonts;
    DROP POLICY IF EXISTS "fonts_insert_own" ON public.custom_fonts;
    DROP POLICY IF EXISTS "fonts_update_own" ON public.custom_fonts;
    DROP POLICY IF EXISTS "fonts_delete_own" ON public.custom_fonts;
    
    ALTER TABLE public.custom_fonts RENAME TO custom_fonts_old;
  END IF;
END $$;


-- ★ STEP 2: profiles 테이블 (신규)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 새 가입시 자동으로 프로필 생성하는 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ★ STEP 3: subscriptions 테이블 (신규)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'quarterly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON public.subscriptions(expires_at);


-- ★ STEP 4: templates 테이블 (신규)
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_user ON public.templates(user_id);


-- ★ STEP 5: custom_phrases 테이블 (새 구조로 재생성)
CREATE TABLE public.custom_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phrases_user ON public.custom_phrases(user_id);


-- ★ STEP 6: custom_fonts 테이블 (새 구조로 재생성)
CREATE TABLE public.custom_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  font_family TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'web')),
  web_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fonts_user ON public.custom_fonts(user_id);


-- ★ STEP 7: print_history 테이블 (신규)
CREATE TABLE IF NOT EXISTS public.print_history (
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

CREATE INDEX IF NOT EXISTS idx_print_history_user ON public.print_history(user_id);
CREATE INDEX IF NOT EXISTS idx_print_history_date ON public.print_history(printed_at);


-- ============================================================
-- ★ STEP 8: Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fonts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_history ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Templates
DROP POLICY IF EXISTS "templates_select_own" ON public.templates;
DROP POLICY IF EXISTS "templates_insert_own" ON public.templates;
DROP POLICY IF EXISTS "templates_update_own" ON public.templates;
DROP POLICY IF EXISTS "templates_delete_own" ON public.templates;
CREATE POLICY "templates_select_own" ON public.templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates_insert_own" ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates_update_own" ON public.templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "templates_delete_own" ON public.templates FOR DELETE USING (auth.uid() = user_id);

-- Custom Phrases
CREATE POLICY "phrases_select_own" ON public.custom_phrases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "phrases_insert_own" ON public.custom_phrases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "phrases_update_own" ON public.custom_phrases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "phrases_delete_own" ON public.custom_phrases FOR DELETE USING (auth.uid() = user_id);

-- Custom Fonts
CREATE POLICY "fonts_select_own" ON public.custom_fonts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fonts_insert_own" ON public.custom_fonts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fonts_update_own" ON public.custom_fonts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fonts_delete_own" ON public.custom_fonts FOR DELETE USING (auth.uid() = user_id);

-- Print History
DROP POLICY IF EXISTS "history_select_own" ON public.print_history;
DROP POLICY IF EXISTS "history_insert_own" ON public.print_history;
CREATE POLICY "history_select_own" ON public.print_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "history_insert_own" ON public.print_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ★ STEP 9: Admin 전체 접근 정책
-- ============================================================
DROP POLICY IF EXISTS "admin_profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "admin_subscriptions_all" ON public.subscriptions;
DROP POLICY IF EXISTS "admin_print_history_all" ON public.print_history;

CREATE POLICY "admin_profiles_all" ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_subscriptions_all" ON public.subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_print_history_all" ON public.print_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ============================================================
-- 완료! 
-- 참고: 기존 데이터는 custom_phrases_old, custom_fonts_old 에 남아있습니다.
-- 필요시 나중에 DROP TABLE custom_phrases_old; 로 정리하세요.
-- ============================================================
