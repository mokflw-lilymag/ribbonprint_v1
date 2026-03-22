import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import {
  Shield, Users, CreditCard, BarChart3, Plus,
  ArrowLeft, Search, Calendar, Printer, RefreshCw, Key, Mail, Trash2, Type, FileText
} from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  payment_method: string;
  amount: number;
}

interface PrintStat {
  user_id: string;
  email: string;
  print_count: number;
}

interface WebFontStat {
  id: string;
  user_id: string;
  email: string;
  font_family: string;
  web_url: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string;
  target_email: string;
  action_type: string;
  details: any;
  reason: string;
  created_at: string;
}

export default function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'users' | 'stats' | 'fonts' | 'logs'>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [printStats, setPrintStats] = useState<PrintStat[]>([]);
  const [webFonts, setWebFonts] = useState<WebFontStat[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'admin' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'event' | 'expired'>('all');

  // 구독 연장 모달
  const [extendModal, setExtendModal] = useState<{ userId: string; email: string } | null>(null);
  const [extendPlan, setExtendPlan] = useState<string>('monthly');
  const [extendDays, setExtendDays] = useState(30);
  const [extendAmount, setExtendAmount] = useState(29900);
  const [extendReason, setExtendReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 사용자 목록
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsers(profileData || []);

      // 구독 현황
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false });
      setSubscriptions(subData || []);

      // 인쇄 통계 (사용자별 횟수)
      const { data: historyData } = await supabase
        .from('print_history')
        .select('user_id, printed_at');

      if (historyData && profileData) {
        const countMap = new Map<string, number>();
        historyData.forEach((h: any) => {
          countMap.set(h.user_id, (countMap.get(h.user_id) || 0) + 1);
        });
        const stats: PrintStat[] = profileData.map((u: any) => ({
          user_id: u.id,
          email: u.email || '',
          print_count: countMap.get(u.id) || 0,
        }));
        stats.sort((a, b) => b.print_count - a.print_count);
        setPrintStats(stats);
      }

      // 웹 폰트 모니터링
      const { data: fontData } = await supabase
        .from('custom_fonts')
        .select('*')
        .eq('source', 'web')
        .order('created_at', { ascending: false });

      if (fontData && profileData) {
        setWebFonts(fontData.map((f: any) => ({
          id: f.id,
          user_id: f.user_id,
          email: profileData.find((p: any) => p.id === f.user_id)?.email || '알 수 없음',
          font_family: f.font_family,
          web_url: f.web_url,
          created_at: f.created_at
        })));
      }

      // 관리자 감사 로그
      const { data: logsData } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (logsData && profileData) {
        setAuditLogs(logsData.map((l: any) => ({
          ...l,
          admin_email: profileData.find((p: any) => p.id === l.admin_id)?.email || '알 수 없음',
          target_email: profileData.find((p: any) => p.id === l.target_user_id)?.email || '알 수 없음',
        })));
      }

    } catch (err) {
      console.error('Admin load error:', err);
    }
    setLoading(false);
  };

  const getUserSub = (userId: string): Subscription | undefined => {
    return subscriptions.find(s => s.user_id === userId);
  };

  const isSubActive = (sub?: Subscription): boolean => {
    if (!sub || !sub.expires_at) return false;
    return new Date(sub.expires_at) > new Date() && sub.status === 'active';
  };

  const handleResetPasswordEmail = async (email: string) => {
    if (!confirm(`${email} 사용자에게 비밀번호 초기화 메일을 발송하시겠습니까?`)) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) alert('메일 발송 실패: ' + error.message);
      else alert('비밀번호 초기화 메일이 성공적으로 발송되었습니다.');
    } catch (e: any) {
      alert('오류 발생: ' + e.message);
    }
  };

  const handleForceResetPassword = async (userId: string, email: string) => {
    const newPassword = prompt(`[관리자 강제변경]\n\n${email} 사용자의 새로운 6자리 이상 비밀번호를 입력해주세요.`);
    if (!newPassword || newPassword.trim() === '') return;

    if (newPassword.length < 6) {
      alert('비밀번호는 최소 6자리 이상이어야 합니다.');
      return;
    }

    if (!confirm(`정말 ${email}의 비밀번호를 '${newPassword}'로 강제 변경하시겠습니까?`)) return;

    try {
      const { error } = await supabase.rpc('admin_reset_password', {
        user_uid: userId,
        new_password: newPassword
      });

      if (error) alert('강제 변경 실패: ' + error.message);
      else alert('비밀번호 강제 변경이 성공적으로 완료되었습니다.');
    } catch (e: any) {
      alert('오류 발생: ' + e.message);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const promptText = prompt(`[경고: 데이터 영구 삭제]\n\n정말 ${email} 회원을 강제로 탈퇴시키겠습니까? 관련된 인쇄 기록 등 모든 데이터가 복구 불가능하게 영구 삭제됩니다.\n\n진행하시려면 '강제탈퇴'를 입력하세요.`);
    if (promptText !== '강제탈퇴') return;

    try {
      const { error } = await supabase.rpc('admin_delete_user', { target_uid: userId });
      if (error) throw error;
      alert('회원 강제 탈퇴가 성공적으로 완료되었습니다.');
      loadData();
    } catch (err: any) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const handleExtend = async () => {
    if (!extendModal) return;
    if (!extendReason.trim()) {
      alert("구독 연장 사유를 반드시 입력해야 합니다. (감사 로그용)");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const adminId = userData.user.id;
      const existingSub = getUserSub(extendModal.userId);
      const baseDate = existingSub?.expires_at && new Date(existingSub.expires_at) > new Date()
        ? new Date(existingSub.expires_at)
        : new Date();

      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + extendDays);

      if (existingSub) {
        // 기존 구독 업데이트
        await supabase
          .from('subscriptions')
          .update({
            plan: extendPlan,
            status: 'active',
            expires_at: newExpiry.toISOString(),
            payment_method: 'admin_manual',
            amount: extendAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSub.id);
      } else {
        // 새 구독 생성
        await supabase
          .from('subscriptions')
          .insert([{
            user_id: extendModal.userId,
            plan: extendPlan,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: newExpiry.toISOString(),
            payment_method: 'admin_manual',
            amount: extendAmount,
          }]);
      }

      // 3. 관리자 감사 로그 작성 (대표 계정은 로그 생략)
      // 대표님께서 실제로 로그인하실 이메일 주소로 아래를 변경해주세요!
      const CEO_EMAIL = 'lilymag0301@gmail.com'; // <-- 이 부분을 실제 대표님 로그인 이메일로 변경하세요

      if (userData.user.email !== CEO_EMAIL) {
        await supabase.from('admin_audit_logs').insert([{
          admin_id: adminId,
          target_user_id: extendModal.userId,
          action_type: 'extend_subscription',
          details: { plan: extendPlan, days: extendDays, amount: extendAmount },
          reason: extendReason,
        }]);
      }

      alert(`${extendModal.email} 구독이 ${newExpiry.toLocaleDateString()}까지 연장되었습니다.`);
      setExtendModal(null);
      setExtendReason('');
      loadData();
    } catch (err: any) {
      alert('연장 실패: ' + err.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const sub = getUserSub(u.id);
    const active = isSubActive(sub);
    const matchesSearch = (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.display_name || '').toLowerCase().includes(search.toLowerCase());

    if (filter === 'all') return matchesSearch;
    if (filter === 'admin') return matchesSearch && u.role === 'admin';
    if (filter === 'expired') return matchesSearch && !active && u.role !== 'admin';
    return matchesSearch && active && sub?.plan === filter;
  });

  const planLabel = (plan: string) => {
    switch (plan) {
      case 'monthly': return '월간';
      case 'quarterly': return '3개월';
      case 'half_yearly': return '6개월';
      case 'yearly': return '연간';
      case 'event': return '이벤트/무료';
      default: return plan;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      {/* Header */}
      <header className="bg-slate-800/80 border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-amber-400/80" />
            <h1 className="text-lg font-semibold">관리자 대시보드</h1>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 p-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-500/20 p-2 rounded-lg"><Users size={20} className="text-blue-400" /></div>
            <span className="text-slate-400 text-sm">전체 가입자</span>
          </div>
          <p className="text-3xl font-semibold">{users.length}<span className="text-base text-slate-500 ml-1">명</span></p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg"><CreditCard size={20} className="text-emerald-400" /></div>
            <span className="text-slate-400 text-sm">활성 구독자</span>
          </div>
          <p className="text-3xl font-semibold text-emerald-400">
            {subscriptions.filter(s => isSubActive(s)).length}
            <span className="text-base text-slate-500 ml-1">명</span>
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-500/20 p-2 rounded-lg"><Printer size={20} className="text-purple-400" /></div>
            <span className="text-slate-400 text-sm">총 인쇄 횟수</span>
          </div>
          <p className="text-3xl font-semibold text-purple-400">
            {printStats.reduce((s, p) => s + p.print_count, 0)}
            <span className="text-base text-slate-500 ml-1">회</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${tab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-white'
            }`}
        >
          <Users size={14} className="inline mr-2" />사용자 관리
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition ${tab === 'stats' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-white'
            }`}
        >
          <BarChart3 size={14} className="inline mr-2" />인쇄 통계
        </button>
        <button
          onClick={() => setTab('fonts')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition ${tab === 'fonts' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-white'
            }`}
        >
          <Type size={14} className="inline mr-2" />웹 폰트 모니터링
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition ${tab === 'logs' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-white'
            }`}
        >
          <FileText size={14} className="inline mr-2" />감사 로그
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {tab === 'users' && (
          <div>
            {/* Search */}
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="이메일 또는 이름으로 검색..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as any)}
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 min-w-[150px]"
              >
                <option value="all">전체 사용자</option>
                <option value="admin">관리자만(🛡️)</option>
                <option value="monthly">월간 구독자</option>
                <option value="quarterly">3개월 구독자</option>
                <option value="half_yearly">6개월 구독자</option>
                <option value="yearly">연간 구독자</option>
                <option value="event">이벤트/무료 구독자</option>
                <option value="expired">구독 만료자</option>
              </select>
            </div>

            {/* User Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">사용자</th>
                    <th className="text-left px-4 py-3">가입일</th>
                    <th className="text-left px-4 py-3">구독 상태</th>
                    <th className="text-left px-4 py-3">만료일</th>
                    <th className="text-left px-4 py-3">인쇄 수</th>
                    <th className="text-center px-4 py-3">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const sub = getUserSub(user.id);
                    const active = isSubActive(sub);
                    const stat = printStats.find(p => p.user_id === user.id);
                    return (
                      <tr key={user.id} className="border-t border-slate-700/50 hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">{user.display_name || '-'}</span>
                            <span className="text-[11px] text-slate-500">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {user.role === 'admin' ? (
                            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">
                              🛡️ 관리자
                            </span>
                          ) : active ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${sub?.plan === 'event' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                              {sub?.plan === 'event' ? '🎁 ' : '✅ '} {planLabel(sub!.plan)}
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-red-500/15 text-red-400 rounded-full text-xs font-semibold">
                              만료
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-300">
                          {stat?.print_count || 0}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              title="구독 연장/부여"
                              onClick={() => setExtendModal({ userId: user.id, email: user.email })}
                              className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-semibold rounded-lg transition flex flex-col items-center"
                            >
                              <Plus size={14} /> 주기
                            </button>
                            <button
                              title="비밀번호 초기화 메일 전송"
                              onClick={() => handleResetPasswordEmail(user.email)}
                              className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-xs font-semibold rounded-lg transition flex flex-col items-center"
                            >
                              <Mail size={14} /> 링크
                            </button>
                            <button
                              title="관리자 권한 강제 비밀번호 변경"
                              onClick={() => handleForceResetPassword(user.id, user.email)}
                              className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-semibold rounded-lg transition flex flex-col items-center"
                            >
                              <Key size={14} /> 강제
                            </button>
                            <button
                              title="회원 강제 삭제"
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="px-2.5 py-1.5 bg-red-900/40 hover:bg-red-900/80 text-red-500 text-xs font-semibold rounded-lg transition flex flex-col items-center ml-2 border border-red-900/50"
                            >
                              <Trash2 size={14} /> 탈퇴
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        {loading ? '로딩 중...' : '사용자가 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400">사용자별 인쇄 횟수 (상위 순)</h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">이메일</th>
                    <th className="text-left px-4 py-3">인쇄 횟수</th>
                    <th className="text-left px-4 py-3">비율</th>
                  </tr>
                </thead>
                <tbody>
                  {printStats.map((stat, idx) => {
                    const total = printStats.reduce((s, p) => s + p.print_count, 0);
                    const pct = total > 0 ? (stat.print_count / total * 100).toFixed(1) : '0';
                    return (
                      <tr key={stat.user_id} className="border-t border-slate-700/50">
                        <td className="px-4 py-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3 text-white">{stat.email}</td>
                        <td className="px-4 py-3 font-semibold text-blue-400 font-mono">{stat.print_count}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 bg-slate-700 rounded-full flex-1 overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-12 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {printStats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-slate-500">인쇄 기록이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'fonts' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 flex items-center justify-between">
              사용자가 등록한 외부 웹 폰트 (보안 모니터링)
              <span className="text-xs font-normal text-amber-400 bg-amber-400/10 px-2 py-1 rounded">1인당 최대 5개 제한 적용됨</span>
            </h3>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">등록일</th>
                    <th className="text-left px-4 py-3">사용자 계정</th>
                    <th className="text-left px-4 py-3">폰트 이름(Family)</th>
                    <th className="text-left px-4 py-3">CSS URL 주소</th>
                    <th className="text-center px-4 py-3">상태 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {webFonts.map(font => (
                    <tr key={font.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(font.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-white">{font.email}</td>
                      <td className="px-4 py-3 font-semibold text-blue-400">{font.font_family}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono truncate max-w-[300px]" title={font.web_url}>
                        {font.web_url}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={async () => {
                            if (!confirm(`스팸/악성 폰트입니까? 강제 삭제하시겠습니까?`)) return;
                            await supabase.from('custom_fonts').delete().eq('id', font.id);
                            loadData();
                          }}
                          className="px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/30 rounded text-xs transition"
                        >
                          강제 삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                  {webFonts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-500">등록된 외부 웹 폰트가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <Shield size={16} /> 최고 관리자용 감사 로그 (Audit Logs)
            </h3>
            <p className="text-xs text-slate-400 mb-2">모든 관리자의 민감한 권한 행사(구독 부여, 권한 변경 등)가 지워지지 않는 기록으로 영구 저장됩니다.</p>
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/50 text-slate-400 text-xs uppercase">
                    <th className="text-left px-4 py-3 min-w-[140px]">발생 일시</th>
                    <th className="text-left px-4 py-3">실행한 관리자</th>
                    <th className="text-left px-4 py-3">대상 고객</th>
                    <th className="text-left px-4 py-3">수행 액션</th>
                    <th className="text-left px-4 py-3 min-w-[300px]">상세 내역 및 사유</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-amber-400 font-semibold">{log.admin_email}</td>
                      <td className="px-4 py-3 text-white">{log.target_email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">
                          {log.action_type === 'extend_subscription' ? '구독권한 부여/연장' : log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-400 font-mono mb-1">
                          {JSON.stringify(log.details)}
                        </div>
                        <div className="text-sm font-semibold text-rose-300">
                          사유: {log.reason}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-500">감사 로그 기록이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Extend Subscription Modal */}
      {extendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Calendar size={18} className="text-blue-400" /> 구독 부여/연장
            </h2>
            <p className="text-sm text-slate-400 mb-5">{extendModal.email}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">요금제</label>
                <select
                  value={extendPlan}
                  onChange={e => {
                    setExtendPlan(e.target.value);
                    if (e.target.value === 'monthly') { setExtendDays(30); setExtendAmount(29900); }
                    else if (e.target.value === 'quarterly') { setExtendDays(90); setExtendAmount(79900); }
                    else if (e.target.value === 'half_yearly') { setExtendDays(180); setExtendAmount(149900); }
                    else if (e.target.value === 'yearly') { setExtendDays(365); setExtendAmount(269900); }
                    else if (e.target.value === 'event') { setExtendDays(7); setExtendAmount(0); }
                  }}
                  className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="monthly">월간 (30일)</option>
                  <option value="quarterly">3개월 (90일)</option>
                  <option value="half_yearly">6개월 (180일)</option>
                  <option value="yearly">연간 (365일)</option>
                  <option value="event">이벤트/무료 쿠폰 (7일)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">기간 (일)</label>
                  <input
                    type="number"
                    value={extendDays}
                    onChange={e => setExtendDays(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm text-center font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">결제 금액 (원)</label>
                  <input
                    type="number"
                    value={extendAmount}
                    onChange={e => setExtendAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm text-center font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-amber-400 font-semibold block mb-1">연장/부여 사유 (감사 로그용 - 필수)</label>
                <input
                  type="text"
                  placeholder="예: 클레임 보상으로 1주일 무료 연장"
                  value={extendReason}
                  onChange={e => setExtendReason(e.target.value)}
                  className="w-full p-2.5 bg-amber-900/20 border border-amber-700/50 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setExtendModal(null)}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold text-sm transition"
                >
                  취소
                </button>
                <button
                  onClick={handleExtend}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition"
                >
                  구독 부여
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
