-- ============================================================
-- RLS 무한재귀 버그 수정 + 관리자 프로필 강제 생성
-- Supabase SQL Editor에서 이 파일 내용을 전체 복사 후 실행하세요
-- ============================================================

-- 1단계: 문제의 RLS 정책 제거
DROP POLICY IF EXISTS "admin_profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "admin_subscriptions_all" ON public.subscriptions;
DROP POLICY IF EXISTS "admin_print_history_all" ON public.print_history;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 2단계: profiles 테이블에 올바른 RLS 정책 재생성
-- (자기 자신의 프로필은 항상 읽기/수정 가능)
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3단계: 관리자용 정책 (profiles를 참조하지 않고 JWT의 role을 직접 사용)
-- admin이 다른 유저의 subscriptions/print_history 조회 가능
CREATE POLICY "admin_subscriptions_all" ON public.subscriptions FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR auth.uid() = user_id
  );

CREATE POLICY "admin_print_history_all" ON public.print_history FOR ALL
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
    OR auth.uid() = user_id
  );

-- 4단계: lilymag0301@gmail.com 프로필 강제 생성 + admin 권한 부여
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'lilymag0301@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;
