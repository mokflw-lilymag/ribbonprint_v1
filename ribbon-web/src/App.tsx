import { useState, useEffect, useRef, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { LogOut } from 'lucide-react';
import { 
  Printer, 
  Settings, 
  Type,
  Maximize2,
  Minimize2,
  RotateCw,
  Undo2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  Wrench,
  Eye,
  Shield,
  Menu,
  X,
  Upload
} from 'lucide-react';
import { FontManagerDialog } from './FontManagerDialog';
import { TemplateManagerDialog } from './TemplateManagerDialog';
import { PhraseManagerDialog } from './PhraseManagerDialog';
import { ManualDialog } from './ManualDialog';
import { FolderOpen, Settings as SettingsIcon, BookOpen } from 'lucide-react';
import { supabase } from './lib/supabase';
import { type CustomFontInfo, getAllCustomFonts, getHiddenFonts } from './lib/font-store';
import { useSubscription } from './lib/use-subscription';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getRemainingDays = (expiresAt: string | null) => {
  if (!expiresAt) return 0;
  const diffTime = new Date(expiresAt).getTime() - new Date().getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

// ==========================================
// Constants & Config
// ==========================================
export type FontLang = 'ko' | 'en' | 'hj' | 'sym';

export interface FontItem {
  value: string;
  name: string;
  langs: FontLang[];
  preview: string;
}

const FONTS: FontItem[] = [
  // 커스텀 한자 폰트 (유저 직접 지정)
  { value: 'font-hj-uoq', name: 'UoqMunThenKhung', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-lxgw', name: 'LXGW WenKai TC', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-klee', name: 'Klee One (Bold 600)', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-iansui', name: 'Iansui', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-syuku', name: 'Yuji Syuku', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-boku', name: 'Yuji Boku', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-mai', name: 'Yuji Mai', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-kaisei', name: 'Kaisei HarunoUmi', langs: ['hj'], preview: '祝發展 謹弔' },
  { value: 'font-hj-zen', name: 'Zen Antique Soft', langs: ['hj'], preview: '祝發展 謹弔' },

  // 붓글씨/서예
  { value: 'font-brush', name: '나눔 붓글씨', langs: ['ko', 'hj', 'en', 'sym'], preview: '아름다운 붓글씨' },
  { value: 'font-dokdo', name: '독도체', langs: ['ko', 'en', 'sym'], preview: '동해물과 백두산이' },
  { value: 'font-gungsuh', name: '궁서체 (기본)', langs: ['ko', 'hj', 'en', 'sym'], preview: '궁서체 기본' },
  { value: 'font-chosun', name: '조선 궁서체', langs: ['ko', 'hj', 'en', 'sym'], preview: '祝發展 謹弔 (조선궁서)' },
  
  // 명조/세리프
  { value: 'font-noto-serif', name: 'Noto Serif (명조)', langs: ['ko', 'hj', 'en', 'sym'], preview: '단정한 명조체' },
  { value: 'font-nanum-myeongjo', name: '나눔명조', langs: ['ko', 'hj', 'en', 'sym'], preview: '나눔명조체' },
  { value: 'font-song', name: '송명체', langs: ['ko', 'hj', 'en', 'sym'], preview: '송명체 테스트' },
  { value: 'font-gowun', name: '고운바탕', langs: ['ko', 'hj', 'en', 'sym'], preview: '고운바탕체' },
  
  // 고딕/산세리프
  { value: 'font-noto-sans', name: 'Noto Sans (고딕)', langs: ['ko', 'hj', 'en', 'sym'], preview: '깔끔한 고딕체' },
  { value: 'font-nanum-gothic', name: '나눔고딕', langs: ['ko', 'hj', 'en', 'sym'], preview: '나눔고딕체' },
  { value: 'font-bold', name: '블랙한산스 (굵음)', langs: ['ko', 'en', 'sym'], preview: '강렬한 굵은 글씨' },
];

function FontSelector({ value, onChange, mode, fonts }: { value: string, onChange: (v: string) => void, mode: FontLang, fonts: FontItem[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hoveredFont, setHoveredFont] = useState<string | null>(null);
  
  const filteredFonts = useMemo(() => {
    return fonts.filter(f => 
      f.langs.includes(mode) && 
      (f.name.toLowerCase().includes(search.toLowerCase()) || 
       f.value.toLowerCase().includes(search.toLowerCase()))
    );
  }, [fonts, mode, search]);

  const selectedFont = fonts.find(f => f.value === value) || fonts[0] || FONTS[0];

  return (
    <div className="relative w-full text-left font-sans">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-slate-900 text-white rounded-lg p-2 text-sm border border-slate-700 outline-none hover:bg-slate-800 transition shadow-sm"
      >
        <span className={cn(selectedFont.value, "text-[15px]")}>{selectedFont.name}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      
      {open && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center px-3 border-b border-slate-700 bg-slate-800/50">
             <Search className="w-4 h-4 text-slate-400" />
             <input 
               type="text" 
               className="w-full bg-transparent border-none outline-none p-2.5 text-sm text-white placeholder:text-slate-500 font-sans" 
               placeholder="폰트 검색..."
               value={search}
               onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1.5 flex flex-col gap-1">
             {filteredFonts.length === 0 && <div className="py-6 text-center text-sm text-slate-500 font-sans">폰트를 찾을 수 없습니다.</div>}
             {filteredFonts.map(f => (
               <button
                 key={f.value}
                 onMouseEnter={() => setHoveredFont(f.value)}
                 onMouseLeave={() => setHoveredFont(null)}
                 onClick={() => { onChange(f.value); setOpen(false); setSearch(""); setHoveredFont(null); }}
                 className={cn(
                   "flex flex-col text-left px-3 py-3 rounded hover:bg-slate-700 transition-colors cursor-pointer w-full group border-b border-slate-700/50 last:border-0",
                   f.value === value ? "bg-blue-900/40" : ""
                 )}
               >
                 <div className="flex w-full items-center justify-between">
                   <div className="flex flex-col w-full pr-2">
                     <span className={cn(
                       (f.value === value || hoveredFont === f.value) ? f.value : "font-sans", 
                       "text-[26px] text-white leading-tight mb-1 group-hover:text-blue-300 transition-colors"
                     )}>
                       {f.preview}
                     </span>
                     <span className="text-[12px] text-slate-400 font-sans">{f.name}</span>
                   </div>
                   {f.value === value && <Check className="w-5 h-5 text-blue-400 shrink-0" />}
                 </div>
               </button>
             ))}
          </div>
        </div>
      )}
      
      {open && <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />}
    </div>
  );
}

const RIBBON_TYPES = [
  { id: 'bouquet', name: '꽃다발 38x400mm', width: 38, lace: 5, length: 400, marginTop: 80, marginBottom: 50, fontSize: 30 },
  { id: 'oriental_45', name: '동양란 45x450mm', width: 45, lace: 7, length: 450, marginTop: 100, marginBottom: 50, fontSize: 35 },
  { id: 'oriental_50', name: '동양란 50x500mm', width: 50, lace: 10, length: 500, marginTop: 120, marginBottom: 80, fontSize: 40 },
  { id: 'orchid_55', name: '동/서양란 55x500mm', width: 55, lace: 10, length: 500, marginTop: 120, marginBottom: 80, fontSize: 42 },
  { id: 'western_60', name: '서양란 60/65x700mm', width: 60, lace: 10, length: 700, marginTop: 150, marginBottom: 100, fontSize: 45 },
  { id: 'movie_70', name: '영화(중) 70x750mm', width: 70, lace: 10, length: 750, marginTop: 150, marginBottom: 100, fontSize: 55 },
  { id: 'basket_95', name: '장바구니 95x1000mm', width: 95, lace: 10, length: 1000, marginTop: 180, marginBottom: 130, fontSize: 75 },
  { id: 'pot_small', name: '화분 소 105/110x1100mm', width: 105, lace: 23, length: 1100, marginTop: 200, marginBottom: 150, fontSize: 80 },
  { id: 'pot_medium', name: '화분 중 135x1500mm', width: 135, lace: 23, length: 1500, marginTop: 300, marginBottom: 200, fontSize: 100 },
  { id: 'pot_large', name: '화분 대 150x1800mm', width: 150, lace: 23, length: 1800, marginTop: 350, marginBottom: 350, fontSize: 110 },
  { id: 'wreath_1', name: '근조 1단 115x1200mm', width: 115, lace: 23, length: 1200, marginTop: 250, marginBottom: 150, fontSize: 90 },
  { id: 'wreath_2', name: '근조 2단 135x1700mm', width: 135, lace: 23, length: 1700, marginTop: 300, marginBottom: 200, fontSize: 100 },
  { id: 'wreath_3', name: '근조 3단 165x2200mm', width: 165, lace: 23, length: 2200, marginTop: 400, marginBottom: 300, fontSize: 130 },
  { id: 'celebration_3', name: '축화 3단 165x2200mm', width: 165, lace: 23, length: 2200, marginTop: 400, marginBottom: 300, fontSize: 130 },
];

const DEFAULT_PHRASE_CATEGORIES = [
  {
    name: '🎉 환갑/칠순/팔순/행사',
    phrases: [
      { text: '祝生日', desc: '축생일' }, { text: '祝생辰', desc: '축생신' }, { text: '祝華甲', desc: '축화갑(60)' },
      { text: '祝壽宴', desc: '축수연(60)' }, { text: '祝回甲', desc: '축회갑(60)' }, { text: '祝古稀', desc: '축고희(70)' },
      { text: '祝七旬', desc: '축칠순(70)' }, { text: '祝喜壽', desc: '축희수(77)' }, { text: '祝八旬', desc: '축팔순(80)' },
      { text: '祝傘壽', desc: '축산수(80)' }, { text: '祝米壽', desc: '축미수(88)' }, { text: '祝白壽', desc: '축백수(99)' },
      { text: 'Happy Birthday!', desc: '생일축하' }
    ]
  },
  {
    name: '🚀 승진/취임/영전',
    phrases: [
      { text: '祝昇進', desc: '축승진' }, { text: '祝榮轉', desc: '축영전' }, { text: '祝就任', desc: '축취임' },
      { text: '祝轉任', desc: '축전임' }, { text: '祝移任', desc: '축이임' }, { text: '祝遷任', desc: '축천임' },
      { text: '祝轉役', desc: '축전역' }, { text: '祝榮進', desc: '축영진' }, { text: '祝選任', desc: '축선임' },
      { text: '祝重任', desc: '축중임' }, { text: '祝連任', desc: '축연임' }, { text: 'Congratulations on your promotion', desc: '승진축하' }
    ]
  },
  {
    name: '🏢 개업/창립/이전',
    phrases: [
      { text: '祝發展', desc: '축발전' }, { text: '祝開業', desc: '축개업' }, { text: '祝盛業', desc: '축성업' },
      { text: '祝繁榮', desc: '축번영' }, { text: '祝創立', desc: '축창립' }, { text: '祝設立', desc: '축설립' },
      { text: '祝創設', desc: '축창설' }, { text: '祝創刊', desc: '축창간' }, { text: '祝移轉', desc: '축이전' },
      { text: '祝開院', desc: '축개원' }, { text: '祝開館', desc: '축개관' }, { text: '祝開場', desc: '축개장' },
      { text: '祝開店', desc: '축개점' }, { text: 'Congratulations on your new business', desc: '개업축하' }
    ]
  },
  {
    name: '💍 결혼/기념일',
    phrases: [
      { text: '祝約婚', desc: '축약혼' }, { text: '祝結婚', desc: '축결혼(男)' }, { text: '祝華婚', desc: '축화혼(女)' },
      { text: '祝成婚', desc: '축성혼' }, { text: '紙婚式', desc: '지혼식(1)' }, { text: '常婚式', desc: '상혼식(2)' },
      { text: '菓婚式', desc: '과혼식(3)' }, { text: '革婚式', desc: '혁혼식(4)' }, { text: '木婚式', desc: '목혼식(5)' },
      { text: '花婚式', desc: '화혼식(7)' }, { text: '祝錫婚式', desc: '축석혼(10)' }, { text: '痲婚式', desc: '마혼식(12)' },
      { text: '祝銅婚式', desc: '축동혼(15)' }, { text: '祝陶婚式', desc: '축도혼(20)' }, { text: '祝銀婚式', desc: '축은혼식(25)' },
      { text: '祝眞珠婚式', desc: '축진주혼식' }, { text: '祝珊瑚婚식', desc: '축산호혼식' }, { text: '祝錄玉婚式', desc: '축녹옥혼식' },
      { text: '祝紅玉婚式', desc: '축홍옥혼식' }, { text: '祝金婚式', desc: '축금혼식(50)' }, { text: '祝金剛婚式', desc: '축금강혼식(60)' },
      { text: 'A Happy Marriage', desc: '행복한결혼' }
    ]
  },
  {
    name: '🖤 죽음/애도',
    phrases: [
      { text: '謹弔', desc: '근조' }, { text: '追慕', desc: '추모' }, { text: '追悼', desc: '추도' },
      { text: '哀悼', desc: '애도' }, { text: '弔意', desc: '조의' }, { text: '尉靈', desc: '위령' },
      { text: '謹悼', desc: '근도' }, { text: '賻儀', desc: '부의' }, { text: '冥福', desc: '명복' },
      { text: '故人의 冥福을 빕니다', desc: '고인의 명복' }, { text: '삼가 故人의 冥福을 빕니다', desc: '삼가 명복' },
      { text: 'You have my condolences', desc: '애도' }, { text: 'Please accept my deepest condolences', desc: '깊은애도' }
    ]
  },
  {
    name: '🏢 준공/기공/개통',
    phrases: [
      { text: '祝起工', desc: '축기공' }, { text: '祝上樑', desc: '축상량' }, { text: '祝竣工', desc: '축준공' },
      { text: '祝開通', desc: '축개통' }, { text: '祝落成', desc: '축낙성' }
    ]
  },
  {
    name: '👶 출산/탄생',
    phrases: [
      { text: '祝順産', desc: '축순산' }, { text: '祝出産', desc: '축출산' }, { text: '祝誕生', desc: '축탄생' },
      { text: '祝得男', desc: '축득남' }, { text: '祝得女', desc: '축득녀' }, { text: '祝公主誕生', desc: '축공주탄생' },
      { text: '祝王子誕生', desc: '축왕자탄생' }, { text: 'Congratulations on your new baby', desc: '출산축하' }
    ]
  },
  {
    name: '📚 창간/출판',
    phrases: [
      { text: '祝創刊', desc: '축창간' }, { text: '祝發刊', desc: '축발간' }, { text: '祝出版紀念', desc: '축출판기념' },
      { text: '出版紀念會', desc: '출판기념회' }
    ]
  },
  {
    name: '🎨 전시/연주',
    phrases: [
      { text: '祝展覽會', desc: '축전람회' }, { text: '祝展示會', desc: '축전시회' }, { text: '祝品評會', desc: '축품평회' },
      { text: '祝博覽會', desc: '축박람회' }, { text: '祝蓮奏會', desc: '축연주회' }, { text: '祝獨奏會', desc: '축독주회' },
      { text: '祝個人展', desc: '축개인전' }
    ]
  },
  {
    name: '🎓 입학/졸업/합격',
    phrases: [
      { text: '祝入學', desc: '축입학' }, { text: '祝卒業', desc: '축졸업' }, { text: '祝合格', desc: '축합격' },
      { text: '祝博士學位記授與', desc: '축박사학위' }, { text: '祝開校', desc: '축개교' }, { text: '頌功', desc: '송공' },
      { text: '祝停年退任', desc: '축정년퇴임' }
    ]
  },
  {
    name: '🏆 우승/당선',
    phrases: [
      { text: '祝優勝', desc: '축우승' }, { text: '祝入選', desc: '축입선' }, { text: '祝必勝', desc: '축필승' },
      { text: '祝健勝', desc: '축건승' }, { text: '祝當選', desc: '축당선' }, { text: '祝被選', desc: '축피선' }
    ]
  },
  {
    name: '⛪ 교회/종교',
    phrases: [
      { text: '獻堂', desc: '헌당' }, { text: '祝長老長立', desc: '축장로장립' }, { text: '牧師按手', desc: '목사안수' },
      { text: '靈名祝日', desc: '영명축일' }, { text: '祝勸士就任', desc: '축권사취임' }, { text: '祝牧師委任', desc: '축목사위임' }
    ]
  },
  {
    name: '🎍 연말연시/시즌',
    phrases: [
      { text: '謹賀新年', desc: '근하신년' }, { text: '送舊迎新', desc: '송구영신' }, { text: '仲秋佳節', desc: '중추가절' },
      { text: 'Happy New Year!', desc: '새해복' }, { text: 'Merry Christmas!', desc: '메리크리스마스' }
    ]
  }
];

const SYMBOL_BANK = ['★', '☆', '(주)', '(유)', '♥', '♡', '♣', '♧', '♠', '♤', '◆', '◇', '▶', '▷', '◀', '◁', '※', '✝', '卍'];

// ==========================================
// Parsing & Types
// ==========================================
interface CharNode {
  type: 'char' | 'bracket' | 'split' | 'fullwidth' | 'space';
  content: string;
  leftContent?: string;
  rightContent?: string;
  isRotated?: boolean;
  id: string; // for stable state tracking
}

const parseRibbonLine = (text: string, baseId: string, rotatedIds: Set<string>): CharNode[] => {
  const nodes: CharNode[] = [];
  const regex = /\[([^/\]]+)\/([^\]]+)\]|\[([^\]]+)\]|\((주|유)\)|( )|./gu;
  let match;
  let charIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const id = `${baseId}-${charIndex++}`;
    const raw = match[0];

    if (match[1] && match[2]) {
      // [left/right]
      const isRotated = rotatedIds.has(id);
      nodes.push({ type: 'split', content: raw, leftContent: match[1], rightContent: match[2], id, isRotated });
    } else if (match[3]) {
      // [bracket]
      const isRotated = rotatedIds.has(id);
      nodes.push({ type: 'bracket', content: match[3], id, isRotated });
    } else if (match[4]) {
      // (주)
      const isRotated = rotatedIds.has(id);
      nodes.push({ type: 'fullwidth', content: raw, id, isRotated });
    } else if (match[5]) {
      // space
      nodes.push({ type: 'space', content: raw, id });
    } else {
      // default all to standing (false), rotate only if user clicked (id exists in rotatedIds)
      const isRotated = rotatedIds.has(id);
      
      nodes.push({ type: 'char', content: raw, id, isRotated });
    }
  }
  return nodes;
};

interface FontConfig {
  ko: string; // Hangeul
  en: string; // Alphanumeric
  hj: string; // Hanja
  sym: string; // Symbols
}

/** 
 * Smart detection of character type
 */
const getCharType = (raw: string): keyof FontConfig => {
  if (/[가-힣]/.test(raw)) return 'ko';  // Any Hangeul inside (like (주)) uses Ko font
  if (/[\u4E00-\u9FFF]/.test(raw)) return 'hj';
  if (/[A-Za-z0-9]/.test(raw)) return 'en';
  return 'sym';
};

// ==========================================
// Ribbon Canvas Component
// ==========================================
interface RibbonCanvasProps {
  text: string;
  fontConfig: FontConfig;
  ratioX: number;    // horizontal percentage scale
  ratioY: number;    // vertical percentage scale
  width: number;
  lace: number;
  length: number;
  marginTop: number;
  marginBottom: number;
  rotatedIds: Set<string>;
  onCharClick: (id: string) => void;
  scaleRatio: number; // rendering scale
  zoom: number;      // current zoom level to compensate UI scale
  spacing: number;   // manual gap percentage (0 = auto/spread)
  side?: 'left' | 'right'; 
  isActive?: boolean;
  onClick?: () => void;
  isPrintMode?: boolean;
  marginOffset?: number;
  shopLogo?: string | null;
  printLogo?: boolean;
}

const RibbonCanvas = ({ 
  text, fontConfig, ratioX, ratioY, width, lace, length, marginTop, marginBottom, 
  rotatedIds, onCharClick, scaleRatio, zoom, spacing, side = 'left', isActive, onClick, isPrintMode = false, marginOffset = 0,
  shopLogo = null, printLogo = false
}: RibbonCanvasProps) => {
  // Parse lines
  const lines = text.split('\n').filter(l => l.trim() !== '');

  // Base font size exactly matches the ribbon printable width in pixels
  const printableWidthPX = Math.max(10, width - (lace * 2)) * scaleRatio;
  const baseFontSizePX = printableWidthPX * 1.15; // Visual 100% Fill (accounts for font margins)

  const scaleXObj = ratioX / 100;
  const scaleYObj = ratioY / 100;

  // Actual block dimensions
  const actualFontSize = baseFontSizePX * scaleYObj;
  const fontScaleX = scaleYObj === 0 ? 1 : scaleXObj / scaleYObj;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative flex justify-center transition-all duration-300",
        isActive ? "ring-4 ring-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] z-10" : "hover:scale-[1.01] cursor-pointer"
      )}
      style={{
        width: `${width * scaleRatio}px`,
        height: `${length * scaleRatio}px`,
        backgroundColor: 'white'
      }}
    >
      {/* Visual Ruler Outside the Ribbon */}
      {!isPrintMode && (
        <>
          <div 
            className={cn(
              "absolute top-0 bottom-0 flex flex-col justify-between font-mono py-1 z-10 pointer-events-none",
              side === 'left' ? "items-end pr-2" : "items-start pl-2"
            )}
            style={{
              width: `${60 / zoom}px`,
              [side === 'left' ? 'right' : 'left']: '100%',
              [side === 'left' ? 'marginRight' : 'marginLeft']: `${20 / zoom}px`
            }}
          >
            <span style={{ transform: `scale(${1/zoom})`, transformOrigin: side === 'left' ? 'right top' : 'left top', fontSize: '14px', color: '#94a3b8', fontWeight: 'bold' }}>0</span>
            <div style={{ width: `${1/zoom}px` }} className={cn("h-full bg-gray-500/50 absolute top-0 bottom-0", side === 'left' ? "right-0" : "left-0")}></div>
            <span style={{ transform: `scale(${1/zoom})`, transformOrigin: side === 'left' ? 'right bottom' : 'left bottom', fontSize: '14px', color: '#94a3b8', fontWeight: 'bold' }}>{length}</span>
          </div>

          {/* Margins Indicators Outside the Ribbon */}
          <div 
            className={cn("absolute border-red-500/70 z-20 pointer-events-none", side === 'left' ? "right-full" : "left-full")}
            style={{ 
              top: `${marginTop * scaleRatio}px`,
              borderTopWidth: `${1/zoom}px`,
              borderTopStyle: 'dashed',
              width: `${120 / zoom}px`, // Constant line length on screen
              [side === 'left' ? 'marginRight' : 'marginLeft']: '0px'
            }}
          >
            <span 
              className={cn("absolute text-[14px] text-red-500 font-bold bg-[#0f172a] px-1 whitespace-nowrap", side === 'left' ? "left-0" : "right-0")}
              style={{ 
                transform: `scale(${1/zoom})`, 
                transformOrigin: side === 'left' ? 'left bottom' : 'right bottom',
                bottom: `${0.3/zoom}rem`
              }}
            >
              상단여백 {marginTop}
            </span>
          </div>

          <div 
            className={cn("absolute border-red-500/70 z-20 pointer-events-none", side === 'left' ? "right-full" : "left-full")}
            style={{ 
              bottom: `${marginBottom * scaleRatio}px`,
              borderBottomWidth: `${1/zoom}px`,
              borderBottomStyle: 'dashed',
              width: `${120 / zoom}px`, // Constant line length on screen
              [side === 'left' ? 'marginRight' : 'marginLeft']: '0px'
            }}
          >
            <span 
              className={cn("absolute text-[14px] text-red-500 font-bold bg-[#0f172a] px-1 whitespace-nowrap", side === 'left' ? "left-0" : "right-0")}
              style={{ 
                transform: `scale(${1/zoom})`, 
                transformOrigin: side === 'left' ? 'left top' : 'right top',
                top: `${0.3/zoom}rem`
              }}
            >
              하단여백 {marginBottom}
            </span>
          </div>
        </>
      )}

      {/* Ribbon Body */}
      <div className={cn("relative overflow-hidden flex flex-col items-center", !isPrintMode ? "bg-white ribbon-texture shadow-2xl" : "bg-white")} style={{ width: '100%', height: '100%' }}>
        
        {/* Lace Effects */}
        {!isPrintMode && lace > 0 && (
          <>
            <div className="absolute left-0 top-0 bottom-0 border-r border-[#00000010] flex flex-col overflow-hidden" style={{ width: `${lace * scaleRatio}px` }}>
               <div className="flex-1 w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200/20 to-transparent" style={{ backgroundSize: '4px 4px' }} />
            </div>
            <div className="absolute right-0 top-0 bottom-0 border-l border-[#00000010] flex flex-col overflow-hidden" style={{ width: `${lace * scaleRatio}px` }}>
               <div className="flex-1 w-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200/20 to-transparent" style={{ backgroundSize: '4px 4px' }} />
            </div>
          </>
        )}

        {/* Text Container boundaries = exact margins */}
        <div 
          className="absolute left-0 right-0 flex flex-row-reverse justify-center gap-4"
          style={{
            top: `${marginTop * scaleRatio}px`,
            bottom: `${marginBottom * scaleRatio}px`,
            transform: `translateX(${marginOffset * scaleRatio}px)`,
          }}
        >
          {lines.map((line, lIdx) => {
            const nodes = parseRibbonLine(line, `L${lIdx}`, rotatedIds);
            
            // Mathematically calculate required height (Full Fit logic)
            const requiredHeight = nodes.reduce((sum, n) => {
               if (n.type === 'space') return sum + (actualFontSize * 0.7);

               // Buffer and scaling factor for multi-line nodes
               const nodePadding = (actualFontSize * 0.6); // Increased safety margin

               if (n.type === 'split') {
                 const leftL = n.leftContent?.length || 0;
                 const rightL = n.rightContent?.length || 0;
                 if (n.isRotated) {
                    // Rotated split: single column + 1 space gap + safety margin
                    return sum + ((leftL + rightL + 1) * actualFontSize * 0.7) + nodePadding;
                 }
                 return sum + (Math.max(leftL, rightL) * actualFontSize * 0.7) + nodePadding;
               }
               if (n.type === 'bracket') {
                 return sum + (n.content.length * actualFontSize * 0.7) + nodePadding;
               }
               if (n.type === 'fullwidth') {
                 if (n.isRotated) {
                   const contentL = n.content.length;
                   return sum + (contentL * actualFontSize * 0.8) + (actualFontSize * 0.5);
                 }
                 return sum + actualFontSize;
               }
               return sum + actualFontSize;
            }, 0);
            
            const gapPX = spacing > 0 ? (actualFontSize * spacing / 100) : 0;
            const totalRequiredHeight = requiredHeight + (nodes.length > 1 ? (nodes.length - 1) * gapPX : 0);
            
            const availableHeight = Math.max(0, (length - marginTop - marginBottom) * scaleRatio);
            let squashRatio = 1;
            if (totalRequiredHeight > availableHeight && availableHeight > 0) {
              squashRatio = availableHeight / totalRequiredHeight;
            }

            return (
              <div 
                key={lIdx} 
                className="flex flex-col items-center shrink-0 w-max text-black font-semibold whitespace-nowrap"
                style={{
                  height: squashRatio < 1 ? `${totalRequiredHeight}px` : (spacing === 0 ? '100%' : 'auto'),
                  transform: squashRatio < 1 ? `scaleY(${squashRatio})` : 'none',
                  transformOrigin: 'top center',
                  justifyContent: nodes.length === 1 ? 'center' : (spacing === 0 ? 'space-between' : 'flex-start'),
                  gap: spacing > 0 ? `${gapPX}px` : undefined
                }}
              >
                {nodes.map(node => {
                  const nodeH = actualFontSize;
                  const nodeW = baseFontSizePX * scaleXObj;

                  // Law 5: Space 65% Height
                  if (node.type === 'space') {
                    return <div key={node.id} style={{ height: `${nodeH * 0.65}px`, width: nodeW }} />;
                  }

                  // Law 4: Fullwidth
                  if (node.type === 'fullwidth') {
                    const charFont = fontConfig[getCharType(node.content)];
                    const chars = node.content.split('');
                    
                    // Rotated: single column like bracket
                    if (node.isRotated) {
                       const blockHeight = chars.length * actualFontSize * 0.8;
                       return (
                         <div 
                           key={node.id} 
                           className={cn("flex flex-col items-center justify-between shrink-0 py-1 cursor-pointer hover:text-blue-600 transition-colors", charFont)} 
                           style={{ height: blockHeight + (actualFontSize * 0.5), width: nodeW }}
                           onClick={() => onCharClick(node.id)}
                         >
                           {chars.map((c, i) => (
                              <span key={i} className={fontConfig[getCharType(c)]} style={{ 
                                fontSize: `${actualFontSize * 0.80}px`, 
                                display: 'inline-block',
                                fontWeight: 'bold',
                                lineHeight: 1,
                                transform: `scaleX(${fontScaleX}) rotate(90deg)`
                              }}>{c}</span>
                           ))}
                         </div>
                       );
                    }

                    // Normal: upright
                    return (
                      <div 
                        key={node.id} 
                        className={cn("flex justify-center items-center shrink-0 cursor-pointer hover:text-blue-600 transition-colors", charFont)} 
                        style={{ height: actualFontSize, width: nodeW }}
                        onClick={() => onCharClick(node.id)}
                      >
                         <div className="flex items-center justify-center" style={{ transform: `scaleX(${fontScaleX})` }}>
                           {chars.map((c, i) => (
                             <span key={i} className={fontConfig[getCharType(c)]} style={{ 
                               fontSize: `${actualFontSize * 0.80}px`, 
                               display: 'inline-block',
                               marginLeft: i > 0 ? '-0.20em' : '0',
                               fontWeight: 'bold',
                               lineHeight: 1
                             }}>{c}</span>
                           ))}
                         </div>
                      </div>
                    );
                  }

                  // Law 2: Special Bracket Multi-line (e.g. [HongGilDong])
                  if (node.type === 'bracket') {
                    const chars = node.content.split('');
                    const blockHeight = chars.length * actualFontSize * 0.7; // increased from 0.65
                    
                    return (
                      <div 
                        key={node.id} 
                        className={cn("flex flex-col items-center shrink-0 leading-none py-1 cursor-pointer hover:text-blue-600 transition-colors", chars.length > 1 ? "justify-between" : "justify-center")} 
                        style={{ 
                          height: blockHeight + (actualFontSize * 0.6), 
                          width: nodeW
                        }}
                        onClick={() => onCharClick(node.id)}
                      >
                        {chars.map((c, i) => (
                           <span key={i} className={fontConfig[getCharType(c)]} style={{ 
                             fontSize: `${actualFontSize * 0.7 * (1 + (fontScaleX - 1) * 0.5)}px`, 
                             lineHeight: 1,
                             display: 'inline-block',
                             fontWeight: 'bold',
                             transform: `scaleX(${fontScaleX}) ${node.isRotated ? 'rotate(90deg)' : ''}`
                           }}>{c}</span>
                        ))}
                      </div>
                    );
                  }

                  // Law 3: Split Columns (Parallel vertical stacks)
                  if (node.type === 'split') {
                    const leftChars = node.leftContent?.split('') || [];
                    const rightChars = node.rightContent?.split('') || [];
                    const maxLen = Math.max(leftChars.length, rightChars.length);

                    // Rotated: single column like bracket, [] size (70%), with space between left/right
                    if (node.isRotated) {
                      const totalChars = leftChars.length + rightChars.length;
                      const blockHeight = (totalChars + 1) * actualFontSize * 0.7; // +1 space
                      return (
                        <div 
                          key={node.id} 
                          className="flex flex-col items-center shrink-0 leading-none py-1 cursor-pointer hover:text-blue-600 transition-colors justify-between" 
                          style={{ height: blockHeight + (actualFontSize * 0.6), width: nodeW }}
                          onClick={() => onCharClick(node.id)}
                        >
                          {leftChars.map((c, i) => (
                            <span key={`l${i}`} className={fontConfig[getCharType(c)]} style={{ 
                              fontSize: `${actualFontSize * 0.7 * (1 + (fontScaleX - 1) * 0.5)}px`, 
                              lineHeight: 1,
                              display: 'inline-block',
                              fontWeight: 'bold',
                              transform: `scaleX(${fontScaleX}) rotate(90deg)`
                            }}>{c}</span>
                          ))}
                          {/* / → space gap */}
                          <div style={{ height: `${actualFontSize * 0.7}px` }} />
                          {rightChars.map((c, i) => (
                            <span key={`r${i}`} className={fontConfig[getCharType(c)]} style={{ 
                              fontSize: `${actualFontSize * 0.7 * (1 + (fontScaleX - 1) * 0.5)}px`, 
                              lineHeight: 1,
                              display: 'inline-block',
                              fontWeight: 'bold',
                              transform: `scaleX(${fontScaleX}) rotate(90deg)`
                            }}>{c}</span>
                          ))}
                        </div>
                      );
                    }

                    // Normal: two parallel columns
                    const blockHeight = maxLen * actualFontSize * 0.7; // increased
                    return (
                      <div 
                        key={node.id} 
                        className="flex flex-row items-center justify-center shrink-0 py-1 cursor-pointer hover:text-blue-600 transition-colors" 
                        style={{ height: blockHeight + (actualFontSize * 0.6), width: nodeW }}
                        onClick={() => onCharClick(node.id)}
                      >
                         <div className={cn("flex flex-col items-center h-full flex-1", leftChars.length > 1 ? "justify-between" : "justify-center")}>
                           {leftChars.map((char, i) => (
                             <div key={i} className={cn("flex items-center justify-center shrink-0", fontConfig[getCharType(char)])} style={{ height: blockHeight / maxLen, width: '100%' }}>
                               <span className={fontConfig[getCharType(char)]} style={{ 
                                 fontSize: `${actualFontSize * 0.45 * (1 + (fontScaleX - 1) * 0.5)}px`, 
                                 display: 'inline-block',
                                 lineHeight: 1,
                                 fontWeight: 'bold',
                                 transform: `scaleX(${fontScaleX})`
                               }}>{char}</span>
                             </div>
                           ))}
                         </div>
                         <div className={cn("flex flex-col items-center h-full flex-1", rightChars.length > 1 ? "justify-between" : "justify-center")}>
                           {rightChars.map((char, i) => (
                             <div key={i} className={cn("flex items-center justify-center shrink-0", fontConfig[getCharType(char)])} style={{ height: blockHeight / maxLen, width: '100%' }}>
                               <span className={fontConfig[getCharType(char)]} style={{ 
                                 fontSize: `${actualFontSize * 0.45 * (1 + (fontScaleX - 1) * 0.5)}px`, 
                                 display: 'inline-block',
                                 lineHeight: 1,
                                 fontWeight: 'bold',
                                 transform: `scaleX(${fontScaleX})`
                               }}>{char}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                    );
                  }

                  // Law 1: Normal / 90-degree Rotation
                  const charFont = fontConfig[getCharType(node.content)];
                  return (
                    <div 
                      key={node.id} 
                      className="cursor-pointer hover:text-blue-600 transition-colors flex justify-center items-center shrink-0 leading-none"
                      style={{ height: nodeH, width: nodeW }}
                      onClick={() => onCharClick(node.id)}
                    >
                      <span className={charFont} style={{ 
                        fontSize: nodeH,
                        transform: `scaleX(${fontScaleX}) ${node.isRotated ? 'rotate(90deg)' : ''}`,
                        display: 'inline-block'
                      }}>
                        {node.content}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* --- SHOP LOGO INJECTION --- */}
        {printLogo && shopLogo && (
            <div 
              className="absolute left-0 right-0 flex justify-center items-center pointer-events-none"
              style={{
                top: `${(length - marginBottom) * scaleRatio}px`,
                transform: `translateX(${marginOffset * scaleRatio}px)`,
                height: `${marginBottom * scaleRatio}px`,
                paddingLeft: `${lace * scaleRatio}px`,
                paddingRight: `${lace * scaleRatio}px`
              }}
            >
               <img 
                 crossOrigin="anonymous"
                 src={shopLogo} 
                 alt="Logo" 
                 style={{ width: '70%', maxWidth: '100%', maxHeight: '80%', objectFit: 'contain', opacity: 0.5 }} 
               />
            </div>
        )}
      </div>
    </div>
  );
};


// ==========================================
// Main Application
// ==========================================
import type { Session } from '@supabase/supabase-js';

const REQUIRED_BRIDGE_VERSION = "6.1";
export default function App({ session, isAdmin, onShowAdmin }: { session?: Session; isAdmin?: boolean; onShowAdmin?: () => void }) {
  const mainRef = useRef<HTMLElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Subscription State
  const { subscription, loading: subLoading } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  // isRightPanelOpen removed to satisfy lint as requested

  const checkSubscriptionAction = async (action: () => void) => {
    // 체험 계정 판별 및 마케팅 페이월 (Paywall)
    if (session?.user?.email === 'test@test.com') {
      alert("🚨 실제 인쇄 및 저장은 개인 계정 가입 후 무료로 이용 가능합니다.\n지금 1분 만에 가입하세요!");
      await supabase.auth.signOut();
      return;
    }

    if (isAdmin || subscription.isActive) {
      action();
    } else {
      setShowPaywall(true);
    }
  };

  // Printer State
  const [printers, setPrinters] = useState<any[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // User Print Settings
  const [printTarget, setPrintTarget] = useState<'both' | 'left' | 'right'>('both');
  const [printLayout, setPrintLayout] = useState<'connected' | 'separate'>('connected');
  const [mediaType, setMediaType] = useState<'roll' | 'cut'>('roll');
  const [cuttingMargin, setCuttingMargin] = useState(50); // 커팅 여유분 (mm), 기본 5cm = 50mm
  const [printQuality, setPrintQuality] = useState<'fast' | 'high'>('fast');

  const connectedPrintRef = useRef<HTMLDivElement>(null);
  const separateLeftRef = useRef<HTMLDivElement>(null);
  const separateRightRef = useRef<HTMLDivElement>(null);

  // Specs State
  const [ribbonType, setRibbonType] = useState(RIBBON_TYPES[0].id);
  const [length, setLength] = useState(400);
  const [width, setWidth] = useState(38);
  const [lace, setLace] = useState(5);
  const [marginTop, setMarginTop] = useState(80);
  const [marginBottom, setMarginBottom] = useState(50);
  const [marginOffset, setMarginOffset] = useState<number>(0);

  // Left Ribbon State
  const [leftText, setLeftText] = useState('祝發展');
  const [leftFontConfig, setLeftFontConfig] = useState<FontConfig>({
    ko: 'font-chosun',
    en: 'font-chosun',
    hj: 'font-chosun',
    sym: 'font-noto-sans'
  });
  const [leftRatioX, setLeftRatioX] = useState(100);
  const [leftRatioY, setLeftRatioY] = useState(100);
  const [leftRotated, setLeftRotated] = useState<Set<string>>(new Set());

  const [leftSpacing, setLeftSpacing] = useState(0); // 0 = auto

  // Right Ribbon State
  const [rightText, setRightText] = useState('(주)릴리맥플라워랩 [CEO] 홍길동');
  const [rightFontConfig, setRightFontConfig] = useState<FontConfig>({
    ko: 'font-chosun',
    en: 'font-chosun',
    hj: 'font-chosun',
    sym: 'font-noto-sans'
  });
  const [rightRatioX, setRightRatioX] = useState(100);
  const [rightRatioY, setRightRatioY] = useState(100);
  const [rightRotated, setRightRotated] = useState<Set<string>>(new Set());
  const [rightSpacing, setRightSpacing] = useState(0); // 0 = auto

  // UI State
  const [activeSide, setActiveSide] = useState<'left'|'right'>('left');
  const [zoom, setZoom] = useState(0.4);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [phraseCategory, setPhraseCategory] = useState(0);
  const [fontWizardMode, setFontWizardMode] = useState<keyof FontConfig>('ko');
  const [fontWizardModeRight, setFontWizardModeRight] = useState<keyof FontConfig>('ko');

  // Font Manager State
  const [customFontItems, setCustomFontItems] = useState<CustomFontInfo[]>([]);
  const [hiddenFonts, setHiddenFonts] = useState<string[]>([]);
  const [customStyles, setCustomStyles] = useState<{id: string, css: string}[]>([]);
  const [isFontManagerOpen, setIsFontManagerOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isPhraseManagerOpen, setIsPhraseManagerOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [phraseCategories, setPhraseCategories] = useState(DEFAULT_PHRASE_CATEGORIES);

  // Shop Logo State
  const [shopLogo, setShopLogo] = useState<string | null>(null);
  const [printLogo, setPrintLogo] = useState<boolean>(false);

  // Panning State
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking the background main area or canvas holder (not buttons/inputs)
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) return;

    if (!mainRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - mainRef.current.offsetLeft);
    setStartY(e.pageY - mainRef.current.offsetTop);
    setScrollLeft(mainRef.current.scrollLeft);
    setScrollTop(mainRef.current.scrollTop);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !mainRef.current) return;
    e.preventDefault();
    const x = e.pageX - mainRef.current.offsetLeft;
    const y = e.pageY - mainRef.current.offsetTop;
    const walkX = (x - startX);
    const walkY = (y - startY);
    mainRef.current.scrollLeft = scrollLeft - walkX;
    mainRef.current.scrollTop = scrollTop - walkY;
  };

  const stopDragging = () => setIsDragging(false);

  const loadCustomPhrases = async () => {
    try {
      const { data, error } = await supabase.from('custom_phrases').select('*');
      if (error) throw error;
      
      if (!data || data.length === 0) {
        setPhraseCategories(DEFAULT_PHRASE_CATEGORIES);
        return;
      }

      // Merge defaults with custom phrases
      const grouped = new Map();
      DEFAULT_PHRASE_CATEGORIES.forEach(cat => grouped.set(cat.name, [...cat.phrases]));

      data.forEach((p: any) => {
        const catName = p.category;
        if (!grouped.has(catName)) {
          grouped.set(catName, []);
        }
        grouped.get(catName).push({ text: p.text, desc: p.description || '' });
      });

      const merged = Array.from(grouped.entries()).map(([name, phrases]) => ({ name, phrases }));
      setPhraseCategories(merged);

      // Adjust selection if the current category index is out of bounds
      setPhraseCategory(prev => prev >= merged.length ? 0 : prev);

    } catch (err) {
      console.error('Error loading custom phrases:', err);
      setPhraseCategories(DEFAULT_PHRASE_CATEGORIES);
    }
  };

  useEffect(() => {
    loadCustomPhrases();
  }, []);

  const loadFontSettings = async () => {
    const hidden = getHiddenFonts();
    setHiddenFonts(hidden || []);
    
    try {
      const custom = await getAllCustomFonts();
      setCustomFontItems(custom);
      
      const styles: {id: string, css: string}[] = [];
      for (const font of custom) {
         if (font.source === 'local' && font.blob) {
           const url = URL.createObjectURL(font.blob);
           styles.push({
             id: font.id,
             css: `
               @font-face {
                 font-family: '${font.fontFamily}';
                 src: url('${url}');
               }
               .${font.id} { font-family: '${font.fontFamily}', sans-serif !important; }
             `
           });
         } else if (font.source === 'web' && font.webUrl) {
           styles.push({
             id: font.id,
             css: `
               @import url('${font.webUrl}');
               .${font.id} { font-family: ${font.fontFamily} !important; }
             `
           });
         }
      }
      setCustomStyles(styles);
    } catch (e) {
      console.error("Failed to load custom fonts", e);
    }
  };

  useEffect(() => {
    loadFontSettings();
    // Load Printers
    fetch('http://127.0.0.1:8000/api/printers')
      .then(res => res.json())
      .then(res => {
        if (res.status === 'success' && Array.isArray(res.data)) {
          setPrinters(res.data);
          if (res.data.length > 0) setSelectedPrinter(res.data[0].name);
        }
      })
      .catch(err => console.error("Failed to fetch printers", err));

    // Auto-Pair Cloud Print Agent with Local Bridge
    if (session?.user?.id) {
       if ((session.user as any)?.user_metadata?.shop_logo) {
         setShopLogo((session.user as any).user_metadata.shop_logo);
         setPrintLogo(true);
       }
       fetch('http://localhost:8000/api/pair', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ user_id: session.user.id })
       }).catch(() => {
         // Silently fail if local bridge is not running (e.g. on mobile remote usage)
       });
    }
  }, [session?.user?.id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setShopLogo(base64);
      setPrintLogo(true);
      if (session?.user) {
        await supabase.auth.updateUser({
          data: { shop_logo: base64 }
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = async () => {
    // 구독 상태 확인 (관리자는 항상 허용)
    if (!isAdmin && !subscription.isActive) {
       setShowPaywall(true);
       return;
    }

    try {
      setIsPrinting(true);
      
      // 1. Bridge 연결 상태 사전 확인
      let bridgeOnline = false;
      let bridgeVersion = "";
      try {
        const healthCheck = await fetch('http://127.0.0.1:8000/', { 
          signal: AbortSignal.timeout(3000) 
        });
        const health = await healthCheck.json();
        bridgeOnline = health.status === 'ok';
        bridgeVersion = health.version || 'unknown';
        console.log(`[Print] Bridge status: ${health.status}, version: ${bridgeVersion}`);
      } catch {
        console.log('[Print] Local bridge not available');
      }

      if (!bridgeOnline) {
        setIsBridgeModalOpen(true);
        setIsPrinting(false);
        return;
      }
      
      if (bridgeVersion !== REQUIRED_BRIDGE_VERSION) {
        setIsUpdateModalOpen(true);
        setIsPrinting(false);
        return;
      }
      
      const sendJob = async (ref: React.RefObject<HTMLDivElement | null>, w: number, h: number, label: string) => {
        if (!ref.current) {
          throw new Error(`캡처 영역(${label})을 찾을 수 없습니다.`);
        }
        
        console.log(`[Print] Capturing ${label}... (${w}x${h}mm)`);
        
        // 고품질 이미지 캡처 (pixelRatio 4 = 고해상도)
        const dataUrl = await toPng(ref.current, {
          pixelRatio: 4,
          backgroundColor: '#ffffff',
          cacheBust: false,
          skipAutoScale: true,
          style: {
            transform: 'none', // 캡처 시 CSS transform 제거하여 올바른 방향 보장
          }
        });

        const imageSize = Math.round(dataUrl.length * 0.75 / 1024); // approx KB
        console.log(`[Print] Image captured: ~${imageSize}KB`);

        // 로컬 브릿지 인쇄 시도
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
          
          const response = await fetch('http://127.0.0.1:8000/api/print_image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              printer_name: selectedPrinter,
              image_base64: dataUrl,
              width_mm: w,
              length_mm: h + (mediaType === 'roll' ? cuttingMargin : 0),
              media_type: mediaType,
              cutting_margin_mm: mediaType === 'roll' ? cuttingMargin : 0,
              print_quality: printQuality,
              margin_offset_mm: marginOffset
            }),
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
              console.log(`[Print] ✅ Local print success (${result.method || 'native'})`);
              return; // 성공!
            }
            // 로컬 실패 시 에러 메시지 표시
            throw new Error(result.message || '인쇄 실패');
          } else {
            throw new Error(`Bridge HTTP ${response.status}`);
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            throw new Error('인쇄 시간이 초과되었습니다 (60초). 프린터 연결을 확인해주세요.');
          }
          // 진짜 에러 (브릿지는 연결되었는데 인쇄 실패)
          console.error(`[Print] Local bridge error: ${err.message}`);
          throw err;
        }
      };

      if (printTarget === 'left') {
        await sendJob(separateLeftRef, width, length, '경조사');
        alert("✅ 경조사 인쇄 완료!");
      } else if (printTarget === 'right') {
        await sendJob(separateRightRef, width, length, '보내는이');
        alert("✅ 보내는이 인쇄 완료!");
      } else {
        // 양쪽 모두
        if (printLayout === 'connected') {
          await sendJob(connectedPrintRef, width, length * 2, '양쪽연결');
          alert("✅ 양쪽 연결 인쇄 완료!");
        } else {
          await sendJob(separateLeftRef, width, length, '경조사');
          // 프린터가 첫 번째 작업을 처리할 시간 부여
          await new Promise(r => setTimeout(r, 2000));
          await sendJob(separateRightRef, width, length, '보내는이');
          alert("✅ 각각 인쇄 완료! (총 2건)");
        }
      }

    } catch (error: any) {
       console.error("[Print] Error:", error);
       
       // 사용자 친화적 에러 메시지
       let userMessage = error.message || '알 수 없는 오류';
       if (userMessage.includes('fetch') || userMessage.includes('network')) {
         userMessage = '프린터 브릿지에 연결할 수 없습니다.\n\n💡 해결방법:\n1. RibbonBridge가 실행 중인지 확인\n2. 방화벽 설정 확인\n3. 프린터가 켜져있는지 확인';
       }
       
       alert("❌ 인쇄 오류: " + userMessage);
    } finally {
       setIsPrinting(false);

       // 인쇄 이력 저장 (실패해도 무시)
       try {
         const { data: { user } } = await supabase.auth.getUser();
         if (user) {
           await supabase.from('print_history').insert([{
             user_id: user.id,
             ribbon_type: ribbonType,
             width,
             length,
             left_text: leftText,
             right_text: rightText,
             printer_name: selectedPrinter,
           }]);
         }
       } catch (_) { /* 이력 저장 실패는 무시 */ }
    }
  };

  const extendedFonts = useMemo(() => {
    const custom: FontItem[] = customFontItems.map(f => ({
      value: f.id,
      name: f.name,
      langs: ['ko', 'hj', 'en', 'sym'],
      preview: '祝發展 謹弔'
    }));
    return [...custom, ...FONTS];
  }, [customFontItems]);

  const availableFonts = useMemo(() => {
    return extendedFonts.filter(f => !hiddenFonts.includes(f.value));
  }, [extendedFonts, hiddenFonts]);

  // Auto-Zoom Calculation (Runs on major layout changes only)
  useEffect(() => {
    if (mainRef.current && length > 0) {
      const padX = 20;
      const padY = 40;
      const availableH = mainRef.current.clientHeight - padY * 2;
      const availableW = mainRef.current.clientWidth - padX * 2;
      
      const targetH = length * 2;
      const targetW = width * 2;
      
      if (targetH > 0 && targetW > 0 && availableH > 0 && availableW > 0) {
        const zoomH = availableH / targetH;
        const zoomW = availableW / targetW;
        setZoom(Math.min(1.5, zoomH, zoomW));
      }
    }
  }, [isSidebarOpen]); // Re-fit when side panel toggles

  useEffect(() => {
    const defaultSpecs = RIBBON_TYPES.find(t => t.id === ribbonType);
    if (defaultSpecs) {
      setWidth(defaultSpecs.width);
      setLace(defaultSpecs.lace);
      setLength(defaultSpecs.length);
      setMarginTop(defaultSpecs.marginTop); 
      setMarginBottom(defaultSpecs.marginBottom);
      
      // Auto-fit on type change
      if (mainRef.current) {
        const padX = 20;
        const padY = 40;
        const availableH = mainRef.current.clientHeight - padY * 2;
        const availableW = mainRef.current.clientWidth - padX * 2;
        const targetH = defaultSpecs.length * 2;
        const targetW = defaultSpecs.width * 2;
        if (targetH > 0 && targetW > 0 && availableH > 0 && availableW > 0) {
           setZoom(Math.min(1.5, availableH / targetH, availableW / targetW));
        }
      }
    }
  }, [ribbonType]);

  const insertSymbol = (sym: string) => {
    if (activeSide === 'left') setLeftText(prev => prev + sym);
    else setRightText(prev => prev + sym);
  };

  const toggleRotation = (id: string, side: 'left'|'right') => {
    const toggleSet = (prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    };
    if (side === 'left') setLeftRotated(toggleSet);
    else setRightRotated(toggleSet);
  };

  const handleRotateAll = (side: 'left'|'right') => {
    const text = side === 'left' ? leftText : rightText;
    const lines = text.split('\n').filter(l => l.trim() !== '');
    const newRotated = new Set<string>();
    lines.forEach((line, lIdx) => {
      // Must match RibbonCanvas baseId pattern: 'L' + index
      const nodes = parseRibbonLine(line, `L${lIdx}`, new Set());
      nodes.forEach(n => {
        if (n.type === 'char' || n.type === 'fullwidth' || n.type === 'bracket' || n.type === 'split') newRotated.add(n.id);
      });
    });
    if (side === 'left') setLeftRotated(newRotated);
    else setRightRotated(newRotated);
  };

  const handleResetRotation = (side: 'left'|'right') => {
    if (side === 'left') setLeftRotated(new Set());
    else setRightRotated(new Set());
  };

  const currentConfig = {
    ribbonType, length, width, lace, marginTop, marginBottom,
    leftText, leftFontConfig, leftRatioX, leftRatioY, leftRotated: Array.from(leftRotated), leftSpacing,
    rightText, rightFontConfig, rightRatioX, rightRatioY, rightRotated: Array.from(rightRotated), rightSpacing,
    printTarget, printLayout, mediaType, cuttingMargin, printQuality
  };

  const onLoadConfig = (c: any) => {
    if (!c) return;
    if (c.ribbonType) setRibbonType(c.ribbonType);
    if (c.length) setLength(c.length);
    if (c.width) setWidth(c.width);
    if (c.lace !== undefined) setLace(c.lace);
    if (c.marginTop !== undefined) setMarginTop(c.marginTop);
    if (c.marginBottom !== undefined) setMarginBottom(c.marginBottom);
    
    if (c.leftText !== undefined) setLeftText(c.leftText);
    if (c.leftFontConfig) setLeftFontConfig(c.leftFontConfig);
    if (c.leftRatioX) setLeftRatioX(c.leftRatioX);
    if (c.leftRatioY) setLeftRatioY(c.leftRatioY);
    if (c.leftRotated) setLeftRotated(new Set(c.leftRotated));
    if (c.leftSpacing !== undefined) setLeftSpacing(c.leftSpacing);

    if (c.rightText !== undefined) setRightText(c.rightText);
    if (c.rightFontConfig) setRightFontConfig(c.rightFontConfig);
    if (c.rightRatioX) setRightRatioX(c.rightRatioX);
    if (c.rightRatioY) setRightRatioY(c.rightRatioY);
    if (c.rightRotated) setRightRotated(new Set(c.rightRotated));
    if (c.rightSpacing !== undefined) setRightSpacing(c.rightSpacing);

    if (c.printTarget) setPrintTarget(c.printTarget);
    if (c.printLayout) setPrintLayout(c.printLayout);
    if (c.mediaType) setMediaType(c.mediaType);
    if (c.cuttingMargin !== undefined) setCuttingMargin(c.cuttingMargin);
    if (c.printQuality) setPrintQuality(c.printQuality);
  };

  return (
    <div className="flex bg-slate-900 text-slate-200 h-screen w-screen overflow-hidden text-sm">
      
      {/* 1. Left Panel: Config Sidebar (Mobile/Desktop Sync) */}
      <aside className={cn(
        "glass-panel relative lg:sticky top-0 left-0 bottom-0 h-full shrink-0 z-40 p-4 lg:p-5 overflow-y-auto border-r border-slate-700 transition-all duration-300 transform-gpu bg-slate-900/95 lg:bg-transparent",
        isSidebarOpen 
          ? "w-[260px] sm:w-72 lg:w-80 translate-x-0" 
          : "w-0 p-0 overflow-hidden border-none -translate-x-10 lg:absolute lg:opacity-0"
      )}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <img src="/logo.png" alt="Ribbonist Logo" className="w-6 h-6 object-contain" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Ribbonist</span>
              </h1>
              <span className="text-[8px] text-slate-500 uppercase tracking-widest ml-8 font-medium">Friends of Florist</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white transition"
              title="메뉴 닫기"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
            <div className="flex items-center gap-1.5">
              <button 
                className="lg:hidden p-1.5 rounded-lg bg-slate-700 text-white"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X size={20} />
              </button>
            {isAdmin && (
              <button
                onClick={onShowAdmin}
                className="p-1.5 rounded-lg hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition" 
                title="관리자 대시보드"
              >
                <Shield size={18} />
              </button>
            )}
            <button
              onClick={async () => { await supabase.auth.signOut(); }}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition" title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-mono">Build 2026.03 (Full-Fit Engine)</p>
          {session?.user?.email && (
            <p className="text-[10px] text-blue-400/80 mt-1 truncate" title={session.user.email}>👤 {session.user.email}</p>
          )}
          {/* Subscription Badge */}
          {!subLoading && (
            <div className={`mt-2 px-2 py-1.5 rounded-lg text-[10px] font-medium text-center border tracking-wide ${
              isAdmin
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : subscription.isActive 
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
            }`}>
              {isAdmin
                ? '🛡️ 관리자 - 모든 기능 가능'
                : subscription.isActive 
                  ? `✅ ${subscription.plan === 'yearly' ? '연간' : subscription.plan === 'quarterly' ? '3개월' : subscription.plan === 'half_yearly' ? '6개월' : subscription.plan === 'event' ? '이벤트' : '월간'} 구독중 (잔여: ${getRemainingDays(subscription.expiresAt)}일)`
                  : '🔓 무료 체험 중 (인쇄 제한)'}
            </div>
          )}
        </div>

        {/* Specs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-300 font-semibold mb-2 border-b border-slate-700 pb-2">
            <Settings size={16} /> 하드웨어 규격
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">프리셋</label>
            <select 
              value={ribbonType} 
              onChange={e => setRibbonType(e.target.value)}
              className="w-full p-2 rounded-lg text-sm"
            >
              {RIBBON_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">폭 (mm)</label>
              <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="w-full p-2 rounded-lg text-sm text-center font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">길이 (mm)</label>
              <input type="number" value={length} onChange={e => setLength(Number(e.target.value))} className="w-full p-2 rounded-lg text-sm text-center font-mono" />
            </div>
          </div>
          
          <div>
            <label className="text-xs text-slate-400 block mb-1">인쇄 대상 / 용지</label>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2">
                 <button 
                  onClick={() => setPrintTarget('both')}
                  className={cn("p-2 rounded-lg text-xs transition", printTarget === 'both' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                 >양쪽 모두</button>
                 <button 
                  onClick={() => setPrintTarget('left')}
                  className={cn("p-2 rounded-lg text-xs transition", printTarget === 'left' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                 >경조사</button>
                 <button 
                  onClick={() => setPrintTarget('right')}
                  className={cn("p-2 rounded-lg text-xs transition", printTarget === 'right' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700")}
                 >보내는이</button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                 {mediaType === 'roll' ? (
                   <select 
                     value={cuttingMargin} 
                     onChange={e => setCuttingMargin(Number(e.target.value))}
                     className="p-2 rounded-lg text-xs bg-slate-800 border-slate-700 text-white focus:ring-1"
                   >
                     {[1,2,3,4,5,6,7,8,9,10].map(cm => (
                       <option key={cm} value={cm * 10}>✂️ 커팅 {cm}cm</option>
                     ))}
                   </select>
                 ) : (
                   <div className="p-2 rounded-lg text-xs bg-slate-900/50 text-slate-500 flex items-center justify-center italic">커팅 불필요</div>
                 )}
                 <select 
                   value={mediaType} 
                   onChange={e => setMediaType(e.target.value as any)}
                   className="p-2 rounded-lg text-xs bg-slate-800 border-slate-700 text-white outline-none focus:ring-1"
                 >
                   <option value="roll">🔄 롤 리본</option>
                   <option value="cut">📄 컷 리본</option>
                 </select>
                 <select 
                   value={printQuality} 
                   onChange={e => setPrintQuality(e.target.value as any)}
                   className="p-2 rounded-lg text-xs bg-slate-800 border-slate-700 text-white outline-none focus:ring-1"
                 >
                   <option value="fast">⚡ 고속 인쇄</option>
                   <option value="high">💎 고급(저속)</option>
                 </select>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">출력 프린터</label>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", printers.length > 0 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500")} />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tighter">Bridge v6.0</span>
              </div>
            </div>
            <div className="flex gap-2">
              <select 
                value={selectedPrinter} 
                onChange={e => setSelectedPrinter(e.target.value)}
                className="flex-1 p-2 rounded-lg text-sm bg-slate-800 border-slate-700 text-white outline-none focus:ring-2"
              >
                {printers.length === 0 && <option value="">☁️ 매장 기본 프린터로 원격 전송</option>}
                {printers.map((p: any) => (
                  <option key={p.name} value={p.name}>
                    {p.brand === 'epson' ? '🟢' : p.brand === 'hp' ? '🔵' : '⚪'} {p.name} {p.status === 'Ready' ? '✅' : '⚠️'}
                  </option>
                ))}
              </select>
              <button 
                onClick={() => {
                  fetch('http://127.0.0.1:8000/api/printers')
                    .then(res => res.json())
                    .then(res => res.status === 'success' && setPrinters(res.data));
                }}
                title="목록 갱신"
                className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition"
              >
                <RotateCw size={14} className={isPrinting ? "animate-spin" : ""} />
              </button>
            </div>
            {/* Engine Badge */}
            {printers.length > 0 && (() => {
              const selected = printers.find((p: any) => p.name === selectedPrinter);
              if (!selected) return null;
              const engineColor = selected.brand === 'epson' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : selected.brand === 'hp' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-slate-500/15 text-slate-400 border-slate-500/30';
              return (
                <div className={`mt-1.5 px-2 py-1 rounded text-[10px] font-medium text-center border ${engineColor}`}>
                  🔧 {selected.engine || 'GDI Fallback'}
                </div>
              );
            })()}
          </div>
          <div className="pt-2 border-t border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                ↔️ 좌우 보정(M) <span className="text-[10px] text-slate-500">(±2mm)</span>
              </label>
              <span className={cn("text-xs font-bold", marginOffset === 0 ? "text-slate-500" : "text-blue-400")}>
                {marginOffset > 0 ? `+${marginOffset}` : marginOffset}mm
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">L</span>
              <input 
                type="range" 
                min="-2" max="2" step="0.5" 
                value={marginOffset}
                onChange={e => setMarginOffset(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-[10px] text-slate-500">R</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-700/50">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                🏪 매장 로고 <span className="text-[10px] text-slate-500">(하단 여백 중앙)</span>
              </label>
              <div className="flex items-center gap-2">
                {shopLogo && (
                  <button 
                    onClick={() => {
                        setShopLogo(null);
                        setPrintLogo(false);
                        if (session?.user) supabase.auth.updateUser({ data: { shop_logo: null } });
                    }} 
                    className="text-[10px] text-red-500 font-bold hover:text-red-400"
                  >
                    삭제
                  </button>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={printLogo} onChange={e => setPrintLogo(e.target.checked)} disabled={!shopLogo} />
                  <div className="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
            
            {!shopLogo ? (
              <label className="flex items-center justify-center w-full p-2 mt-1 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:bg-slate-800 transition">
                <span className="text-xs text-slate-400 flex items-center gap-2"><Upload size={14}/> 로고 이미지 등록 (PNG)</span>
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleLogoUpload} />
              </label>
            ) : (
                <div className="flex justify-center mt-1 p-2 bg-slate-800 rounded-lg">
                    <img src={shopLogo} alt="Shop Logo" className="h-8 object-contain bg-white rounded px-2" />
                </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">상단</label>
              <input type="number" value={marginTop} onChange={e => setMarginTop(Number(e.target.value))} className="w-full p-2 rounded-lg text-sm text-center font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">하단</label>
              <input type="number" value={marginBottom} onChange={e => setMarginBottom(Number(e.target.value))} className="w-full p-2 rounded-lg text-sm text-center font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">레이스</label>
              <input type="number" value={lace} onChange={e => setLace(Number(e.target.value))} className="w-full p-2 rounded-lg text-sm text-center font-mono" />
            </div>
          </div>
        </div>

        {/* Left Ribbon Detail */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-semibold mb-1 border-b border-slate-700 pb-2">
            <div className="flex items-center gap-2"><Type size={16} /> 좌측 리본 (경조사)</div>
            <div className="flex items-center gap-1">
              <button 
                title="전체 90도 회전"
                onClick={() => handleRotateAll('left')} 
                className="hover:bg-slate-700 p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <RotateCw size={14} />
              </button>
              <button 
                title="회전 초기화"
                onClick={() => handleResetRotation('left')} 
                className="hover:bg-slate-700 p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <Undo2 size={14} />
              </button>
              <button 
                onClick={() => setActiveSide('left')}
                className={cn("text-[10px] px-2 py-0.5 rounded font-bold transition-all ml-1", activeSide === 'left' ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400")}
              >ACTIVE</button>
            </div>
          </div>
          <input 
            type="text"
            value={leftText} 
            onChange={e => setLeftText(e.target.value)}
            onFocus={() => setActiveSide('left')}
            className="w-full p-2 rounded-lg text-sm leading-tight focus:ring-2 bg-slate-800 border-slate-700 text-white outline-none"
            placeholder="경조사 입력"
          />
          <div className="flex flex-col gap-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400">🧙 폰트 마법사</span>
              <div className="flex gap-1 overflow-x-auto">
                {(['ko', 'hj', 'en', 'sym'] as const).map(type => (
                  <button 
                    key={type}
                    onClick={() => setFontWizardMode(type)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded transition-all whitespace-nowrap",
                      fontWizardMode === type ? "bg-blue-600 text-white shadow-lg" : "bg-slate-700 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {type === 'ko' ? '한글' : type === 'hj' ? '한자' : type === 'en' ? '영/수' : '기호'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 items-center w-full">
              <div className="flex-1 w-full relative">
                <FontSelector 
                  value={leftFontConfig[fontWizardMode]} 
                  onChange={val => setLeftFontConfig(prev => ({ ...prev, [fontWizardMode]: val }))} 
                  mode={fontWizardMode} 
                  fonts={availableFonts}
                />
              </div>
              <button 
                 onClick={() => setIsFontManagerOpen(true)}
                 title="내 폰트 추가 및 관리하기"
                 className="bg-slate-900 border border-slate-700 rounded-lg w-10 flex shrink-0 items-center justify-center hover:bg-slate-700 transition"
                 style={{ height: '38px' }}
              >
                 <Wrench className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                 <span className="bg-slate-700 text-[10px] text-slate-300 px-2 flex items-center justify-center shrink-0 w-12">가로%</span>
                 <input type="number" value={leftRatioX} onChange={e => setLeftRatioX(Number(e.target.value))} className="w-full p-1.5 text-xs text-center font-mono bg-transparent outline-none text-white" />
              </div>
              <div className="flex bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                 <span className="bg-slate-700 text-[10px] text-slate-300 px-2 flex items-center justify-center shrink-0 w-12">세로%</span>
                 <input type="number" value={leftRatioY} onChange={e => setLeftRatioY(Number(e.target.value))} className="w-full p-1.5 text-xs text-center font-mono bg-transparent outline-none text-white" />
              </div>
            </div>
            
            <div className="mt-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-300">자간 (0=자동)</span>
                <span className="text-[10px] font-mono text-blue-400">{leftSpacing === 0 ? 'Auto' : `${leftSpacing}%`}</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" step="5"
                value={leftSpacing} 
                onChange={e => setLeftSpacing(Number(e.target.value))} 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
              />
            </div>
          </div>
        </div>

        {/* Right Ribbon Detail */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-semibold mb-1 border-b border-slate-700 pb-2">
            <div className="flex items-center gap-2"><Type size={16} /> 우측 리본 (보내는이)</div>
            <div className="flex items-center gap-1">
              <button 
                title="전체 90도 회전"
                onClick={() => handleRotateAll('right')} 
                className="hover:bg-slate-700 p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <RotateCw size={14} />
              </button>
              <button 
                title="회전 초기화"
                onClick={() => handleResetRotation('right')} 
                className="hover:bg-slate-700 p-1 rounded text-slate-400 hover:text-white transition-colors"
              >
                <Undo2 size={14} />
              </button>
              <button 
                onClick={() => setActiveSide('right')}
                className={cn("text-[10px] px-2 py-0.5 rounded font-bold transition-all ml-1", activeSide === 'right' ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400")}
              >ACTIVE</button>
            </div>
          </div>
          <input 
            type="text"
            value={rightText} 
            onChange={e => setRightText(e.target.value)}
            onFocus={() => setActiveSide('right')}
            className="w-full p-2 rounded-lg text-sm leading-tight focus:ring-2 bg-slate-800 border-slate-700 text-white outline-none"
            placeholder="보내는이 입력"
          />
          <div className="flex flex-col gap-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400">🧙 폰트 마법사</span>
              <div className="flex gap-1 overflow-x-auto">
                {(['ko', 'hj', 'en', 'sym'] as const).map(type => (
                  <button 
                    key={type}
                    onClick={() => setFontWizardModeRight(type)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded transition-all whitespace-nowrap",
                      fontWizardModeRight === type ? "bg-blue-600 text-white shadow-lg" : "bg-slate-700 text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {type === 'ko' ? '한글' : type === 'hj' ? '한자' : type === 'en' ? '영/수' : '기호'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 items-center w-full">
              <div className="flex-1 w-full relative">
                <FontSelector 
                  value={rightFontConfig[fontWizardModeRight]} 
                  onChange={val => setRightFontConfig(prev => ({ ...prev, [fontWizardModeRight]: val }))} 
                  mode={fontWizardModeRight} 
                  fonts={availableFonts}
                />
              </div>
              <button 
                 onClick={() => setIsFontManagerOpen(true)}
                 title="내 폰트 추가 및 관리하기"
                 className="bg-slate-900 border border-slate-700 rounded-lg w-10 flex shrink-0 items-center justify-center hover:bg-slate-700 transition"
                 style={{ height: '38px' }}
              >
                 <Wrench className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                 <span className="bg-slate-700 text-[10px] text-slate-300 px-2 flex items-center justify-center shrink-0 w-12">가로%</span>
                 <input type="number" value={rightRatioX} onChange={e => setRightRatioX(Number(e.target.value))} className="w-full p-1.5 text-xs text-center font-mono bg-transparent outline-none text-white" />
              </div>
              <div className="flex bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                 <span className="bg-slate-700 text-[10px] text-slate-300 px-2 flex items-center justify-center shrink-0 w-12">세로%</span>
                 <input type="number" value={rightRatioY} onChange={e => setRightRatioY(Number(e.target.value))} className="w-full p-1.5 text-xs text-center font-mono bg-transparent outline-none text-white" />
              </div>
            </div>

            <div className="mt-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-300">자간 (0=자동)</span>
                <span className="text-[10px] font-mono text-blue-400">{rightSpacing === 0 ? 'Auto' : `${rightSpacing}%`}</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" step="5"
                value={rightSpacing} 
                onChange={e => setRightSpacing(Number(e.target.value))} 
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
              />
            </div>
          </div>
        </div>

        {/* Phrase Selector (경조사어 뱅크) */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
             <div className="flex items-center gap-2">
               <h3 className="text-xs font-semibold text-slate-400">자주 쓰는 문구</h3>
               <button onClick={() => setIsPhraseManagerOpen(true)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="상용구 관리 (DB)">
                 <SettingsIcon size={14} />
               </button>
             </div>
             <select 
               value={phraseCategory} 
               onChange={e => setPhraseCategory(Number(e.target.value))}
               className="bg-slate-900 border border-slate-700 text-[10px] rounded px-2 py-1 outline-none focus:ring-1 ring-blue-500 text-slate-300 max-w-[120px]"
             >
               {phraseCategories.map((cat, idx) => <option key={idx} value={idx}>{cat.name.split(' ')[1] || cat.name}</option>)}
             </select>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 select-none">
            {phraseCategories[phraseCategory]?.phrases.map((item, idx) => (
               <button 
                 key={idx} 
                 onClick={() => {
                   if (activeSide === 'left') setLeftText(item.text);
                   else setRightText(item.text);
                 }}
                 className="group bg-slate-900 hover:bg-blue-900/40 border border-slate-700 hover:border-blue-500 rounded p-1.5 transition-all flex flex-col items-center justify-center min-h-[40px] overflow-hidden"
               >
                 <span className="text-[11px] font-semibold text-slate-200 mb-0.5 leading-none truncate w-full text-center">{item.text}</span>
                 <span className="text-[9px] text-slate-500 group-hover:text-blue-300 truncate w-full text-center">{item.desc}</span>
               </button>
            ))}
          </div>
        </div>

        {/* Symbols Data Bank */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 mb-2">특수기호 (Click to Insert)</h3>
          <div className="grid grid-cols-6 gap-1.5 select-none">
            {SYMBOL_BANK.map(sym => (
               <button 
                 key={sym} 
                 onClick={() => insertSymbol(sym)}
                 className="bg-slate-900 hover:bg-brand border border-slate-700 hover:border-brand rounded py-1.5 text-[11px] transition-colors"
               >
                 {sym}
               </button>
            ))}
          </div>
        </div>

        {/* Tip / Manual Button */}
        <div className="mt-4 mb-2 w-full select-none">
          <button
            onClick={() => setIsManualOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg border border-blue-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <BookOpen size={18} />
            Ribbonist 초보자 매뉴얼
          </button>
        </div>

        {/* Customer Support / QA */}
        <div className="mb-10 w-full select-none">
          <div className="bg-slate-800/60 border border-slate-700 p-3.5 rounded-xl border-l-4 border-l-blue-500 flex flex-col gap-1">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1">
              🎧 고객센터 & QnA 핫라인
            </h3>
            <p className="text-[10px] text-slate-400">장애 및 구독 관련 언제든 문의주세요.</p>
            <div className="flex flex-col gap-1 mt-1 text-[11px] font-mono text-slate-300 bg-slate-900/50 p-2 rounded">
              <div className="flex justify-between items-center">
                <span>📞 전화:</span>
                <span className="text-blue-300 font-bold">1588-0000</span>
              </div>
              <div className="flex justify-between items-center">
                <span>💬 카톡:</span>
                <span className="text-amber-400 font-bold cursor-pointer hover:underline border-b border-transparent">@ribbonprint</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Center Panel: Canvas */}
      <main 
        ref={mainRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        className={cn(
          "flex-1 relative overflow-auto p-4 sm:p-12 bg-[#0f172a] min-w-0 transition-all duration-300",
          isSidebarOpen ? "lg:ml-0" : "ml-0",
          "mr-0",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {/* Ribbon Layout Management Buttons (Panel Toggles) */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-1/2 left-0 -translate-y-1/2 z-[45] p-2.5 bg-blue-600 text-white rounded-r-xl shadow-lg border-y border-r border-blue-400/50 hover:bg-blue-500 transition-all active:scale-95 group"
            title="설정 메뉴 열기"
          >
            <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}


        {/* Mobile Menu Toggle Floating Button (Legacy, keep but adjust) */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden fixed top-4 left-4 z-30 p-2.5 bg-blue-600/90 text-white rounded-xl shadow-lg shadow-blue-900/40 backdrop-blur hover:bg-blue-500 transition active:scale-95"
            title="메뉴 열기"
          >
            <Menu size={24} />
          </button>
        )}

        <div className="inline-flex min-w-full min-h-full items-start justify-center py-8 lg:py-12 select-none">
        {/* Design Canvas Area Wrapper to handle Scroll with Zoom */}
        <div 
          className="relative transition-all duration-300 transform-gpu"
          style={{ 
            transform: `scale(${zoom})`, 
            transformOrigin: 'top center',
            // Accurate sizing to fix scrollbars:
            // We need to set the parent's layout size to the SCALED size.
            // But we do it via padding/margins to the inner relative container.
            width: isPreviewMode ? `${(width * 2) * zoom}px` : `${((width * 4) + 100) * zoom}px`, // approximate for double ribbon
            height: `${(length * 2) * zoom}px`,
            marginBottom: '100px'
          }}
        >
          <div className={cn(
            "flex absolute top-0 left-1/2 -translate-x-1/2 transition-all duration-300",
            isPreviewMode ? "gap-4 flex-col items-center" : "flex-col lg:flex-row gap-12 lg:gap-24 items-center",
            isPreviewMode && "bg-slate-800/40 p-10 rounded-3xl border border-slate-700/50 backdrop-blur"
          )}>
          {isPreviewMode ? (
            // ================= PREVIEW MODE =================
            <div className="flex flex-col items-center">
              <div className="text-blue-400 font-semibold mb-8 text-2xl uppercase tracking-widest border-b border-blue-400/30 pb-2">
                Print Preview ({printTarget === 'both' ? (printLayout === 'connected' ? 'Connected' : 'Separate Both') : printTarget})
              </div>
              
              <div className="flex flex-col items-center bg-white shadow-2xl p-4 border-[10px] border-slate-700 rounded-sm">
                {printTarget === 'left' && (
                  <div style={{ transform: 'rotate(180deg)', transformOrigin: 'center center' }}>
                    <RibbonCanvas 
                      text={leftText} fontConfig={leftFontConfig} ratioX={leftRatioX} ratioY={leftRatioY} lace={lace}
                      width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                      rotatedIds={leftRotated} onCharClick={() => {}}
                      scaleRatio={2} zoom={1} spacing={leftSpacing} side="left" marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                    />
                  </div>
                )}
                {printTarget === 'right' && (
                  <div style={{ transform: 'rotate(180deg)', transformOrigin: 'center center' }}>
                    <RibbonCanvas 
                      text={rightText} fontConfig={rightFontConfig} ratioX={rightRatioX} ratioY={rightRatioY} lace={lace}
                      width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                      rotatedIds={rightRotated} onCharClick={() => {}}
                      scaleRatio={2} zoom={1} spacing={rightSpacing} side="right" marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                    />
                  </div>
                )}
                {printTarget === 'both' && printLayout === 'connected' && (
                  <div className="flex flex-col items-center">
                    <div style={{ transform: 'rotate(180deg)', transformOrigin: 'center center' }}>
                      <RibbonCanvas 
                        text={leftText} fontConfig={leftFontConfig} ratioX={leftRatioX} ratioY={leftRatioY} lace={lace}
                        width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                        rotatedIds={leftRotated} onCharClick={() => {}}
                        scaleRatio={2} zoom={1} spacing={leftSpacing} side="left" marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                      />
                    </div>
                    {/* Middle Connection Line */}
                    <div style={{ width: `${(width - lace*2) * 2}px`, height: '4px', backgroundColor: 'black' }} />
                    <RibbonCanvas 
                      text={rightText} fontConfig={rightFontConfig} ratioX={rightRatioX} ratioY={rightRatioY} lace={lace}
                      width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                      rotatedIds={rightRotated} onCharClick={() => {}}
                      scaleRatio={2} zoom={1} spacing={rightSpacing} side="right" marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                    />
                  </div>
                )}
                {printTarget === 'both' && printLayout === 'separate' && (
                  <div className="flex gap-12">
                    <div style={{ transform: 'rotate(180deg)', transformOrigin: 'center center' }}>
                      <RibbonCanvas 
                        text={leftText} fontConfig={leftFontConfig} ratioX={leftRatioX} ratioY={leftRatioY} lace={lace}
                        width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                        rotatedIds={leftRotated} onCharClick={() => {}}
                        scaleRatio={2} zoom={1} spacing={leftSpacing} side="left" marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                      />
                    </div>
                    <div style={{ transform: 'rotate(180deg)', transformOrigin: 'center center' }}>
                      <RibbonCanvas 
                        text={rightText} fontConfig={rightFontConfig} ratioX={rightRatioX} ratioY={rightRatioY} lace={lace}
                        width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                        rotatedIds={rightRotated} onCharClick={() => {}}
                        scaleRatio={2} zoom={1} spacing={rightSpacing} side="right" marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ================= DESIGN MODE =================
            <div 
              ref={printAreaRef}
              className="flex gap-24 transition-transform duration-300 bg-[#0f172a]" 
              style={{ transformOrigin: 'top center' }}
            >
              <RibbonCanvas 
                text={leftText} fontConfig={leftFontConfig} ratioX={leftRatioX} ratioY={leftRatioY} lace={lace}
                width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                rotatedIds={leftRotated} onCharClick={(id) => toggleRotation(id, 'left')}
                scaleRatio={2} zoom={zoom} spacing={leftSpacing} isActive={activeSide === 'left'} marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                onClick={() => setActiveSide('left')} side="left"
              />
              <RibbonCanvas 
                text={rightText} fontConfig={rightFontConfig} ratioX={rightRatioX} ratioY={rightRatioY} lace={lace}
                width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
                rotatedIds={rightRotated} onCharClick={(id) => toggleRotation(id, 'right')}
                scaleRatio={2} zoom={zoom} spacing={rightSpacing} isActive={activeSide === 'right'} marginOffset={marginOffset} shopLogo={shopLogo} printLogo={printLogo}
                onClick={() => setActiveSide('right')} side="right"
              />
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Floating Actions Toolbar */}
        <div className={cn(
          "fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-xl p-2 rounded-full border border-slate-600/50 flex gap-1 sm:gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[60] transition-all duration-300"
        )}>
          <button 
            onClick={() => checkSubscriptionAction(() => setIsTemplateManagerOpen(true))} 
            className="p-2 rounded-full hover:bg-slate-700 text-amber-400 transition-colors flex items-center gap-2 px-4 whitespace-nowrap"
          >
            <FolderOpen size={18} />
            <span className="text-xs font-semibold uppercase">Templates</span>
          </button>
          <div className="w-px h-6 bg-slate-600 my-auto mx-1"></div>
          <button 
            onClick={() => setIsPreviewMode(!isPreviewMode)} 
            className={cn(
              "p-2 rounded-full transition-colors flex items-center gap-2 px-4 whitespace-nowrap", 
              isPreviewMode ? "bg-blue-600 text-white" : "hover:bg-slate-700 text-slate-300"
            )}
          >
            {isPreviewMode ? <Maximize2 size={18} /> : <Eye size={18} />}
            <span className="text-xs font-semibold uppercase">{isPreviewMode ? "Design" : "Preview"}</span>
          </button>
          <div className="w-px h-6 bg-slate-600 my-auto"></div>
          <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><Minimize2 size={18} /></button>
          <div className="px-3 flex items-center justify-center font-mono text-xs text-white">{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><Maximize2 size={18} /></button>
          <div className="w-px h-6 bg-slate-600 my-auto mx-1"></div>
          <button 
            onClick={() => checkSubscriptionAction(handlePrint)}
            disabled={isPrinting}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all shadow-lg",
              isPrinting ? "bg-slate-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            {isPrinting ? (
              <RotateCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Printer size={16} />
            )}
            {isPrinting ? "SENDING..." : "PRINT"}
          </button>
        </div>
      </main>



      {/* Inject custom font styles */}
      <style>
        {customStyles.map(s => s.css).join('\n')}
      </style>

      {/* Font Manager Dialog */}
      <FontManagerDialog 
        isOpen={isFontManagerOpen} 
        onClose={() => {
          setIsFontManagerOpen(false);
          loadFontSettings();
        }} 
        baseFonts={FONTS}
        onSettingsChanged={loadFontSettings}
      />

      {/* Phrase Manager Dialog */}
      <PhraseManagerDialog
        isOpen={isPhraseManagerOpen}
        onClose={() => setIsPhraseManagerOpen(false)}
        onChanged={loadCustomPhrases}
      />

      {/* Manual Dialog */}
      <ManualDialog
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

      {/* Template Manager Dialog */}
      <TemplateManagerDialog
        isOpen={isTemplateManagerOpen}
        onClose={() => setIsTemplateManagerOpen(false)}
        currentConfig={currentConfig}
        onLoad={onLoadConfig}
      />

      {/* Hidden Professional Capture Areas (Not visible to user) */}
      {/* IMPORTANT: No CSS transforms on ref elements! toPng cannot reliably capture CSS transforms.
          Rotation is handled post-capture via Canvas API in handlePrint. */}
      <div style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none', opacity: 0 }}>
        
        {/* 1. Connected Strip Mode [L + Line + R] - printed as continuous strip */}
        <div 
          ref={connectedPrintRef} 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            backgroundColor: 'white',
            width: `${width * 3}px`
          }}
        >
          {/* Left ribbon (경조사) - reversed order via column-reverse */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column-reverse', 
            width: `${width * 3}px`,
            backgroundColor: 'white'
          }}>
            <RibbonCanvas
              text={leftText} fontConfig={leftFontConfig} ratioX={leftRatioX} ratioY={leftRatioY} lace={lace}
              width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
              rotatedIds={leftRotated} onCharClick={() => {}}
              scaleRatio={3} zoom={1} spacing={leftSpacing} side="left" isPrintMode={true}
            />
          </div>
          {/* Middle Connection Line */}
          <div style={{ width: `${(width - lace*2) * 3}px`, height: '6px', backgroundColor: 'black' }} />
          <RibbonCanvas
            text={rightText} fontConfig={rightFontConfig} ratioX={rightRatioX} ratioY={rightRatioY} lace={lace}
            width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
            rotatedIds={rightRotated} onCharClick={() => {}}
            scaleRatio={3} zoom={1} spacing={rightSpacing} side="right" isPrintMode={true}
          />
        </div>

        {/* 2. Separate Mode - NO CSS transform, clean capture */}
        <div ref={separateLeftRef} style={{ backgroundColor: 'white' }}>
          <RibbonCanvas
            text={leftText} fontConfig={leftFontConfig} ratioX={leftRatioX} ratioY={leftRatioY} lace={lace}
            width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
            rotatedIds={leftRotated} onCharClick={() => {}}
            scaleRatio={3} zoom={1} spacing={leftSpacing} side="left" isPrintMode={true}
          />
        </div>
        <div ref={separateRightRef} style={{ backgroundColor: 'white' }}>
          <RibbonCanvas 
            text={rightText} fontConfig={rightFontConfig} ratioX={rightRatioX} ratioY={rightRatioY} lace={lace}
            width={width} length={length} marginTop={marginTop} marginBottom={marginBottom}
            rotatedIds={rightRotated} onCharClick={() => {}}
            scaleRatio={3} zoom={1} spacing={rightSpacing} side="right" isPrintMode={true}
          />
        </div>

      </div>

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-semibold text-white mb-2">구독이 필요합니다</h2>
            <p className="text-slate-400 mb-6">인쇄 기능을 사용하려면 유효한 구독이 필요합니다.<br/>아래에서 요금제를 선택해주세요.</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:border-blue-500 cursor-pointer transition">
                <p className="text-lg font-semibold text-white">1개월</p>
                <p className="text-blue-400 font-semibold text-xl mt-1">₩29,900</p>
                <p className="text-slate-500 text-xs mt-1">월간 결제</p>
              </div>
              <div className="bg-blue-600/20 rounded-xl p-4 border-2 border-blue-500 cursor-pointer transition relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">인기</div>
                <p className="text-lg font-semibold text-white">3개월</p>
                <p className="text-blue-400 font-semibold text-xl mt-1">₩79,900</p>
                <p className="text-slate-500 text-xs mt-1">11% 할인</p>
              </div>
              <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600 hover:border-blue-500 cursor-pointer transition">
                <p className="text-lg font-semibold text-white">12개월</p>
                <p className="text-blue-400 font-semibold text-xl mt-1">₩269,900</p>
                <p className="text-slate-500 text-xs mt-1">25% 할인</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-4">결제 시스템은 준비 중입니다. 관리자에게 문의해주세요.</p>
            <button
              onClick={() => setShowPaywall(false)}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <SaveConfigDialog 
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        onSave={async (name: string) => {
          const { error } = await supabase.from('saved_configs').insert({
            user_id: session?.user.id,
            name,
            config: currentConfig
          });
          if (error) alert('저장 실패: ' + error.message);
          else {
            alert('저장되었습니다!');
            setIsSaveDialogOpen(false);
          }
        }}
      />

      <LoadConfigDialog 
        isOpen={isLoadDialogOpen}
        onClose={() => setIsLoadDialogOpen(false)}
        onLoad={onLoadConfig}
        userId={session?.user.id}
      />

      {/* Bridge Download Modal */}
      {isBridgeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-400"></div>
            <div className="text-6xl mb-4">🖨️</div>
            <h2 className="text-2xl font-semibold text-white mb-2">프린트 브릿지 설치 필요</h2>
            <p className="text-slate-400 mb-6 text-sm">
              클라우드 브라우저에서 로컬 프린터로 인쇄하려면<br/>
              <b>최초 1회 브릿지 프로그램(PC용)</b> 설치가 필요합니다.<br/>
              설치 후 한 번만 실행해두면 다음부터는 자동으로 연결됩니다!
            </p>
            <div className="bg-blue-900/30 border border-blue-500/30 rounded p-3 mb-6 text-left">
              <p className="text-blue-300 text-xs font-semibold mb-1">💡 "Windows의 PC 보호" 창이 나타날 시</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                다운로드 후 첫 실행 시 파란색 창이 뜰 수 있습니다. 당황하지 마시고, 왼쪽 글씨 중 <span className="text-white font-bold underline">추가 정보</span> 버튼을 누르신 후, 우측 하단에 생기는 <span className="text-white font-bold">실행 버튼</span>을 눌러주시면 정상적으로 작동합니다.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setIsBridgeModalOpen(false)}
                className="px-6 py-3 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              >
                닫기
              </button>
              <button 
                onClick={() => {
                  window.open('https://github.com/mokflw-lilymag/ribbonprint_v1/raw/main/RibbonBridge_Setup.zip');
                  setIsBridgeModalOpen(false);
                }}
                className="flex-1 max-w-[200px] px-6 py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-900/40"
              >
                다운로드 및 작동
              </button>
            </div>
          </div>
        </div>
      )}

      <UpdateBridgeModal 
        isOpen={isUpdateModalOpen}
        isUpdating={isUpdating}
        onClose={() => setIsUpdateModalOpen(false)}
        onUpdate={async () => {
          setIsUpdating(true);
          try {
             fetch('http://127.0.0.1:8000/api/update', { method: 'POST' });
          } catch {
            // Error intentionally ignored
          }
          
          let attempts = 0;
          const pollInterval = window.setInterval(async () => {
             attempts++;
             try {
               const check = await fetch('http://127.0.0.1:8000/', { signal: AbortSignal.timeout(1500) });
               const res = await check.json();
               if (res.version === REQUIRED_BRIDGE_VERSION) {
                  clearInterval(pollInterval);
                  setIsUpdating(false);
                  setIsUpdateModalOpen(false);
                  alert("🌟 브릿지 업데이트가 성공적으로 완료되었습니다!");
               }
             } catch (e) {
               // still loading
             }
             if (attempts > 20) {
                clearInterval(pollInterval);
                setIsUpdating(false);
                setIsUpdateModalOpen(false);
                alert("업데이트 시간이 초과되었습니다. 방화벽 문제일 수 있으니 수동 설치를 권장합니다.");
             }
          }, 2000);
        }}
      />
    </div>
  );
}

// Update Bridge Handler Component (inside App, or simple helper)
function UpdateBridgeModal({ isOpen, isUpdating, onClose, onUpdate }: { isOpen: boolean, isUpdating: boolean, onClose: () => void, onUpdate: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-500 to-orange-400"></div>
        <div className="text-6xl mb-4">🚀</div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          {isUpdating ? "업데이트 설치 중..." : "새로운 브릿지 업데이트 발견"}
        </h2>
        <p className="text-slate-400 mb-6 text-sm">
          {isUpdating 
            ? "새로운 버전을 다운로드하고 백그라운드에서 재시작 중입니다.\n이 창을 닫지 말고 잠시만 기다려주세요 (최대 30초 소요)."
            : "안정적인 인쇄를 지원하기 위해\n최신 버전의 필수 패치가 필요합니다.\n\n지금 자동으로 업데이트 하시겠습니까?"}
        </p>
        <div className="flex gap-3 justify-center">
          {!isUpdating && (
            <button 
              onClick={onClose}
              className="px-6 py-3 rounded-lg font-semibold bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            >
              다음에 하기
            </button>
          )}
          <button 
            onClick={onUpdate}
            disabled={isUpdating}
            className={cn(
              "flex-1 max-w-[200px] px-6 py-3 rounded-lg font-semibold text-white transition-colors shadow-lg",
              isUpdating ? "bg-slate-600 cursor-not-allowed" : "bg-orange-600 hover:bg-orange-500 shadow-orange-900/40"
            )}
          >
            {isUpdating ? "기다려주세요..." : "예 (업데이트 시작)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Internal Components that were lost:

function SaveConfigDialog({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300]">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-sm">
        <h3 className="text-lg font-bold text-white mb-4">현재 작업 저장</h3>
        <input 
          type="text" 
          value={name} 
          onChange={e => setName(e.target.value)}
          placeholder="템플릿 이름 입력"
          className="w-full p-2 rounded bg-slate-900 border border-slate-700 text-white mb-4 outline-none focus:ring-1 ring-blue-500"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">취소</button>
          <button onClick={() => { onSave(name); setName(''); }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">저장</button>
        </div>
      </div>
    </div>
  );
}

function LoadConfigDialog({ isOpen, onClose, onLoad, userId }: { isOpen: boolean, onClose: () => void, onLoad: (config: any) => void, userId?: string }) {
  const [configs, setConfigs] = useState<any[]>([]);
  useEffect(() => {
    if (isOpen && userId) {
      supabase.from('saved_configs').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        .then(({ data }) => setConfigs(data || []));
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300]">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-sm">
        <h3 className="text-lg font-bold text-white mb-4">저장된 템플릿</h3>
        <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
          {configs.map(c => (
            <button 
              key={c.id} 
              onClick={() => { onLoad(c.config); onClose(); }}
              className="w-full p-3 bg-slate-900 hover:bg-blue-900/20 border border-slate-700 hover:border-blue-500 rounded text-left transition-all"
            >
              <div className="text-sm font-semibold text-white">{c.name}</div>
              <div className="text-[10px] text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
            </button>
          ))}
          {configs.length === 0 && <div className="text-center py-4 text-slate-500">저장된 내역이 없습니다.</div>}
        </div>
        <button onClick={onClose} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">닫기</button>
      </div>
    </div>
  );
}
