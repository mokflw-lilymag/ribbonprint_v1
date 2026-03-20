import { useState, useEffect, useRef } from 'react';
import { X, Upload, Plus, Trash2, Globe, FileText, Check, Settings } from 'lucide-react';
import { type CustomFontInfo, saveCustomFontToDB, getAllCustomFonts, deleteCustomFontFromDB, getHiddenFonts, setHiddenFonts } from './lib/font-store';
import type { FontItem } from './App';

interface FontManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  baseFonts: FontItem[];
  onSettingsChanged: () => void;
}

export function FontManagerDialog({ isOpen, onClose, baseFonts, onSettingsChanged }: FontManagerDialogProps) {
  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [customFonts, setCustomFonts] = useState<CustomFontInfo[]>([]);
  const [hiddenFonts, setHiddenState] = useState<string[]>([]);
  
  const [addType, setAddType] = useState<'local' | 'web'>('local');
  const [fontName, setFontName] = useState('');
  const [fontFamily, setFontFamily] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadFonts();
    }
  }, [isOpen]);

  const loadFonts = async () => {
    try {
      const custom = await getAllCustomFonts();
      setCustomFonts(custom);
      setHiddenState(getHiddenFonts());
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleHide = (fontId: string) => {
    const newHidden = hiddenFonts.includes(fontId) 
      ? hiddenFonts.filter(id => id !== fontId)
      : [...hiddenFonts, fontId];
    setHiddenState(newHidden);
    setHiddenFonts(newHidden);
    onSettingsChanged();
  };

  const handleDeleteCustom = async (id: string) => {
    if (confirm("이 폰트를 정말 삭제하시겠습니까?")) {
      await deleteCustomFontFromDB(id);
      await loadFonts();
      onSettingsChanged();
    }
  };

  const handleAddFont = async () => {
    if (!fontName) {
      alert("폰트 이름을 입력해주세요.");
      return;
    }
    
    const id = `font-custom-${Date.now()}`;
    const newFont: CustomFontInfo = {
      id,
      name: fontName,
      source: addType,
    };

    if (addType === 'local') {
      if (!selectedFile) {
        alert("폰트 파일을 선택해주세요. (.ttf, .otf 등)");
        return;
      }
      newFont.blob = selectedFile;
      newFont.fontFamily = fontName; 
    } else {
      if (!webUrl || !fontFamily) {
        alert("웹 폰트 CSS 주소와 폰트 패밀리 이름을 모두 입력해주세요.");
        return;
      }
      newFont.webUrl = webUrl;
      newFont.fontFamily = fontFamily;
    }

    try {
      await saveCustomFontToDB(newFont);
      setFontName('');
      setFontFamily('');
      setWebUrl('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTab('list');
      await loadFonts();
      onSettingsChanged();
      alert("성공적으로 커스텀 폰트가 추가되었습니다.");
    } catch (e) {
      alert("폰트 저장 중 오류가 발생했습니다.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            폰트 관리 환경설정
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50">
          <button 
            onClick={() => setTab('list')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'list' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-300'}`}
          >
            내 폰트 목록 및 숨기기
          </button>
          <button 
            onClick={() => setTab('add')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'add' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-300'}`}
          >
            새 폰트 직접 추가
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto w-full">
          {tab === 'list' ? (
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4 text-sm text-slate-300">
                목록에서 체크 해제한 폰트는 드롭다운 메뉴에 나타나지 않습니다. 자유롭게 커스텀해 보세요!
              </div>

              {customFonts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-400 mb-3 ml-1 uppercase tracking-wider">내가 추가한 폰트</h3>
                  <div className="space-y-2">
                    {customFonts.map(font => {
                      const isHidden = hiddenFonts.includes(font.id);
                      return (
                        <div key={font.id} className={`flex w-full items-center justify-between p-3 rounded-lg border ${isHidden ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-200'}`}>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleToggleHide(font.id)} className={`w-5 h-5 rounded flex shrink-0 items-center justify-center border ${isHidden ? 'border-slate-600' : 'bg-blue-500 border-blue-500'}`}>
                              {!isHidden && <Check className="w-3.5 h-3.5 text-white" />}
                            </button>
                            <div className="truncate pr-2">
                               <div className="font-semibold truncate w-[300px]">{font.name}</div>
                               <div className="text-xs opacity-70 flex items-center gap-1 mt-0.5">
                                 {font.source === 'local' ? <FileText className="w-3 h-3"/> : <Globe className="w-3 h-3"/>}
                                 {font.source === 'local' ? '로컬 설치됨 (DB저장됨)' : '외부 웹 폰트 URL'}
                               </div>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteCustom(font.id)} className="p-2 text-rose-400 hover:bg-rose-400/10 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-400 mb-3 mt-6 ml-1 uppercase tracking-wider">기본 제공 폰트</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {baseFonts.map(font => {
                    const isHidden = hiddenFonts.includes(font.value);
                    return (
                      <button 
                        key={font.value}
                        onClick={() => handleToggleHide(font.value)}
                        className={`flex w-full items-center gap-3 p-3 rounded-lg border transition-all text-left ${isHidden ? 'bg-slate-900/50 border-slate-800 text-slate-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'}`}
                      >
                         <div className={`w-5 h-5 rounded flex shrink-0 items-center justify-center border ${isHidden ? 'border-slate-600' : 'bg-blue-500 border-blue-500'}`}>
                            {!isHidden && <Check className="w-3.5 h-3.5 text-white" />}
                         </div>
                         <div className="truncate">
                           <span className={`block font-semibold ${!isHidden ? font.value : ''}`}>{font.name}</span>
                         </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
             <div className="space-y-6">
               <div className="flex gap-4 p-1 bg-slate-800 rounded-lg">
                  <button onClick={() => setAddType('local')} className={`flex-1 py-2 text-sm rounded-md font-medium flex items-center justify-center gap-2 transition-all ${addType === 'local' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                     <Upload className="w-4 h-4" /> 내 PC 폰트 파일 등록
                  </button>
                  <button onClick={() => setAddType('web')} className={`flex-1 py-2 text-sm rounded-md font-medium flex items-center justify-center gap-2 transition-all ${addType === 'web' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                     <Globe className="w-4 h-4" /> 웹 폰트 URL 등록
                  </button>
               </div>

               <div className="bg-slate-800/30 border border-slate-700/50 p-5 rounded-xl space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">폰트 표시 이름</label>
                    <input 
                      type="text" 
                      value={fontName}
                      onChange={e => setFontName(e.target.value)}
                      placeholder="예) 내 맘에 드는 특별 폰트"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  {addType === 'local' ? (
                     <div>
                       <label className="block text-sm font-medium text-slate-300 mb-1">폰트 파일 선택 (.ttf, .otf, .woff)</label>
                       <input 
                         type="file" 
                         ref={fileInputRef}
                         accept=".ttf,.otf,.woff,.woff2"
                         onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                         className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer bg-slate-900 border border-slate-700 rounded-lg"
                       />
                       <p className="text-xs text-slate-500 mt-2">
                         업로드한 폰트는 브라우저 내부 보관함(IndexedDB)에 임시로 자동 저장되어 매번 다시 넣을 필요 없이 편하게 사용할 수 있습니다.
                       </p>
                     </div>
                  ) : (
                     <>
                       <div>
                         <label className="block text-sm font-medium text-slate-300 mb-1">Google Fonts 등 웹 폰트 서식 URL (@import 전체 목록 등에서 http... 주소만 복사)</label>
                         <input 
                           type="text" 
                           value={webUrl}
                           onChange={e => setWebUrl(e.target.value)}
                           placeholder="예) https://fonts.googleapis.com/css2?family=Jua&display=swap"
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 text-sm"
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-slate-300 mb-1">적용될 폰트 패밀리 (CSS Font Family 이름)</label>
                         <input 
                           type="text" 
                           value={fontFamily}
                           onChange={e => setFontFamily(e.target.value)}
                           placeholder="예) 'Jua', sans-serif"
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 text-sm"
                         />
                       </div>
                     </>
                  )}

                  <button 
                    onClick={handleAddFont}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> 폰트 커스텀 메뉴에 추가
                  </button>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
