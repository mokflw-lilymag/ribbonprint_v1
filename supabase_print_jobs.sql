CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    printer_name TEXT,
    image_base64 TEXT NOT NULL,
    width_mm INTEGER NOT NULL,
    length_mm INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', 
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own print jobs" ON public.print_jobs;
CREATE POLICY "Users can manage their own print jobs" 
ON public.print_jobs FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_print_jobs_user_status ON public.print_jobs(user_id, status);
