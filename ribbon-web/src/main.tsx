import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Auth from './Auth.tsx'
import AdminDashboard from './AdminDashboard.tsx'
import { supabase } from './lib/supabase.ts'
import type { Session } from '@supabase/supabase-js'

function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setIsAdmin(false);
        setShowAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 관리자 권한 확인
  useEffect(() => {
    if (session?.user?.id) {
      // 1. 특정 이메일은 항상 관리자로 인정 (치트키)
      if (session.user.email === 'lilymag0301@gmail.com') {
        setIsAdmin(true);
        return;
      }

      // 2. 나머지는 DB 확인
      supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          setIsAdmin(data?.role === 'admin');
        });
    }
  }, [session?.user?.id, session?.user?.email]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-blue-400 font-medium">초기화 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthenticated={() => {}} />
  }

  // 관리자 대시보드 뷰
  if (showAdmin && isAdmin) {
    return <AdminDashboard onBack={() => setShowAdmin(false)} />
  }

  // App component with admin toggle
  return (
    <App
      session={session}
      isAdmin={isAdmin}
      onShowAdmin={() => setShowAdmin(true)}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

