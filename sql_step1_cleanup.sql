-- ============================================================
-- STEP 1: 기존 테이블 모두 정리 (이것을 먼저 실행하세요)
-- ============================================================

DROP POLICY IF EXISTS "phrases_select_own" ON public.custom_phrases;
DROP POLICY IF EXISTS "phrases_insert_own" ON public.custom_phrases;
DROP POLICY IF EXISTS "phrases_update_own" ON public.custom_phrases;
DROP POLICY IF EXISTS "phrases_delete_own" ON public.custom_phrases;
DROP POLICY IF EXISTS "fonts_select_own" ON public.custom_fonts;
DROP POLICY IF EXISTS "fonts_insert_own" ON public.custom_fonts;
DROP POLICY IF EXISTS "fonts_update_own" ON public.custom_fonts;
DROP POLICY IF EXISTS "fonts_delete_own" ON public.custom_fonts;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "templates_select_own" ON public.templates;
DROP POLICY IF EXISTS "templates_insert_own" ON public.templates;
DROP POLICY IF EXISTS "templates_update_own" ON public.templates;
DROP POLICY IF EXISTS "templates_delete_own" ON public.templates;
DROP POLICY IF EXISTS "history_select_own" ON public.print_history;
DROP POLICY IF EXISTS "history_insert_own" ON public.print_history;
DROP POLICY IF EXISTS "admin_profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "admin_subscriptions_all" ON public.subscriptions;
DROP POLICY IF EXISTS "admin_print_history_all" ON public.print_history;

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
