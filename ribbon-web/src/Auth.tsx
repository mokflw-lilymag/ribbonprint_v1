import { useState } from 'react';
import { supabase } from './lib/supabase';
import { Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react';

export default function Auth({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('가입 확인 이메일을 전송했습니다. 이메일을 확인해주세요!');
      }
    } catch (err: any) {
      if (err.message.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.message.includes('User already registered')) {
        setError('이미 가입된 계정입니다. 로그인을 시도해주세요.');
      } else {
        setError(err.message || '인증 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans pattern-bg">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-700">
        <div className="p-8 text-center border-b border-slate-700 bg-slate-800/50">
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">RibbonPrint <span className="text-blue-500">SaaS</span></h1>
          <p className="text-slate-400 text-sm">프리미엄 리본 출력 서비스에 오신 것을 환영합니다</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">이메일</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full block rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">비밀번호</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 w-full block rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{error}</div>}
            {message && <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-sm">{message}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
              {isLogin ? '로그인' : '계정 생성'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
              className="text-sm text-slate-400 hover:text-white transition"
            >
              {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
