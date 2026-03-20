-- ============================================================
-- STEP 3: RLS 보안 정책 (Step 2 완료 후 실행하세요)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fonts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_history ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Subscriptions
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Templates
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
CREATE POLICY "history_select_own" ON public.print_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "history_insert_own" ON public.print_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin 전체 접근
CREATE POLICY "admin_profiles_all" ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_subscriptions_all" ON public.subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin_print_history_all" ON public.print_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
