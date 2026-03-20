import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Save, FolderOpen, Trash2, X } from 'lucide-react';

interface TemplateProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: any;
  onLoad: (config: any) => void;
}

export function TemplateManagerDialog({ isOpen, onClose, currentConfig, onLoad }: TemplateProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setTemplates(data || []);
    }
    setIsLoading(false);
  };

  const saveTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert("템플릿 이름을 입력해주세요.");
      return;
    }

    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("로그인이 필요합니다."); return; }

      const { error } = await supabase.from('templates').insert([
        {
          user_id: user.id,
          name: newTemplateName.trim(),
          config: currentConfig
        }
      ]);

      if (error) throw error;
      
      setNewTemplateName('');
      alert("성공적으로 저장되었습니다.");
      fetchTemplates();
    } catch (err: any) {
      console.error(err);
      alert("저장 실패: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`'${name}' 템플릿을 삭제하시겠습니까?`)) return;
    
    setIsLoading(true);
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      fetchTemplates();
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <FolderOpen size={18} className="text-blue-400" /> 템플릿 보관함
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-6 font-sans">
          
          {/* New Template Form */}
          <div className="flex flex-col gap-2 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <label className="text-xs font-semibold text-slate-300">현재 디자인 저장하기</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="템플릿 이름 입력 (예: 화환 기본 세팅)"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <button 
                onClick={saveTemplate}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={16} /> 저장
              </button>
            </div>
          </div>

          {/* Template List */}
          <div className="flex flex-col flex-1 min-h-[200px] max-h-[400px]">
            <label className="text-xs font-semibold text-slate-400 mb-3 block">저장된 템플릿 목록</label>
            
            <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-2">
              {isLoading && templates.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">로딩 중...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">저장된 템플릿이 없습니다.</div>
              ) : (
                templates.map(tpl => (
                  <div key={tpl.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-700 bg-slate-800 hover:border-blue-500/50 transition-colors group">
                    <div className="flex flex-col cursor-pointer flex-1" onClick={() => { onLoad(tpl.config); onClose(); }}>
                      <span className="text-white text-sm font-semibold">{tpl.name}</span>
                      <span className="text-slate-500 text-[10px] mt-0.5">
                        {new Date(tpl.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button 
                         onClick={() => { onLoad(tpl.config); onClose(); }}
                         className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-semibold transition-colors"
                      >
                         불러오기
                      </button>
                      <button 
                         onClick={() => deleteTemplate(tpl.id, tpl.name)}
                         className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                         title="삭제"
                      >
                         <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
