-- ============================================================
-- RibbonPrint SaaS - 관리자 감사 로그(Audit Logs) 테이블 생성
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details JSONB,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS 활성화
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. 정책 설정 (관리자만 조회 및 작성 가능)
DROP POLICY IF EXISTS "admin_logs_select_all" ON public.admin_audit_logs;
CREATE POLICY "admin_logs_select_all" ON public.admin_audit_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "admin_logs_insert" ON public.admin_audit_logs;
CREATE POLICY "admin_logs_insert" ON public.admin_audit_logs FOR INSERT 
  WITH CHECK (auth.uid() = admin_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
