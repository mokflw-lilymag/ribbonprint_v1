-- ============================================================
-- RibbonPrint SaaS - Supabase Database Schema
-- Run this SQL in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. 사용자 프로필 (User Profiles)
-- Supabase Auth의 auth.users 와 1:1 연결
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


-- 2. 구독/요금제 (Subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'monthly', 'quarterly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_method TEXT,        -- 'card', 'transfer', 'admin_manual'
  payment_reference TEXT,     -- PG 결제 고유번호
  amount INTEGER DEFAULT 0,   -- 결제 금액 (원)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_expires ON public.subscriptions(expires_at);


-- 3. 사용자 템플릿 저장 (Templates)
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL,      -- 전체 리본 설정 JSON
  thumbnail_url TEXT,         -- 미리보기 이미지 URL
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_user ON public.templates(user_id);


-- 4. 자주 쓰는 문구 (Custom Phrases)
CREATE TABLE IF NOT EXISTS public.custom_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_phrases_user ON public.custom_phrases(user_id);


-- 5. 사용자 커스텀 폰트 (Custom Fonts metadata)
CREATE TABLE IF NOT EXISTS public.custom_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  font_family TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('local', 'web')),
  web_url TEXT,
  storage_path TEXT,          -- Supabase Storage 경로 (로컬 업로드 시)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fonts_user ON public.custom_fonts(user_id);


-- 6. 인쇄 이력 (Print History / Telemetry)
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

CREATE INDEX idx_print_history_user ON public.print_history(user_id);
CREATE INDEX idx_print_history_date ON public.print_history(printed_at);


-- ============================================================
-- Row Level Security (RLS) - 사용자는 자신의 데이터만 접근
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fonts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_history ENABLE ROW LEVEL SECURITY;

-- Profiles: 본인 프로필만 조회/수정
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: 본인 구독만 조회 (생성/수정은 서버 또는 관리자만)
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Templates: 본인만 CRUD
CREATE POLICY "templates_select_own" ON public.templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "templates_insert_own" ON public.templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "templates_update_own" ON public.templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "templates_delete_own" ON public.templates FOR DELETE USING (auth.uid() = user_id);

-- Custom Phrases: 본인만 CRUD
CREATE POLICY "phrases_select_own" ON public.custom_phrases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "phrases_insert_own" ON public.custom_phrases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "phrases_update_own" ON public.custom_phrases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "phrases_delete_own" ON public.custom_phrases FOR DELETE USING (auth.uid() = user_id);

-- Custom Fonts: 본인만 CRUD
CREATE POLICY "fonts_select_own" ON public.custom_fonts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fonts_insert_own" ON public.custom_fonts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fonts_update_own" ON public.custom_fonts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fonts_delete_own" ON public.custom_fonts FOR DELETE USING (auth.uid() = user_id);

-- Print History: 본인만 조회/추가
CREATE POLICY "history_select_own" ON public.print_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "history_insert_own" ON public.print_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Admin용 정책: role = 'admin'인 사용자가 전체 데이터 조회 가능
-- ============================================================
CREATE POLICY "admin_profiles_all" ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_subscriptions_all" ON public.subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_print_history_all" ON public.print_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ============================================================
-- Storage Bucket 생성 (폰트 및 로고 파일용)
-- Supabase Dashboard > Storage 에서 수동으로 생성해도 됩니다
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-assets', 'user-assets', false);

-- ============================================================
-- 완료! 모든 테이블과 RLS 정책이 생성되었습니다.
-- ============================================================
