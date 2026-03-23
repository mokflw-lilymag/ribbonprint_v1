import { X, BookOpen, Settings, PenTool } from 'lucide-react';

export function ManualDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[500] p-4">
      <div className="bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-600 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-blue-400 w-6 h-6" />
            Ribbonist 시작 가이드
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-8 text-sm md:text-base text-slate-300">
          
          {/* Step 1 */}
          <section className="bg-slate-900/50 p-6 rounded-xl border-t-4 border-slate-700 hover:border-blue-500 transition-colors">
            <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">1</span> 
              가장 먼저 해야 할 일: 하드웨어 기본 설정
            </h3>
            <div className="space-y-3 text-slate-300 ml-9">
              <p>출력을 시작하기 전, 내가 쓸 <strong>'리본 용지'와 '프린터'</strong>를 프로그램에 딱 맞게 세팅하는 단계입니다.</p>
              <ul className="list-disc list-outside ml-5 space-y-2 text-sm leading-relaxed text-slate-400 mt-2">
                <li><strong className="text-slate-200">리본 폭/길이 선택:</strong> 화면 좌측상단 <strong>[프리셋]</strong>에서 자신이 보유한 리본(예: 3줄짜리 100mm 등)을 고릅니다.</li>
                <li><strong className="text-amber-400">롤 리본 vs 컷 리본:</strong> 이게 정말 중요합니다! 돌돌 말려있는 <strong>'롤 리본'</strong>이라면 글씨가 잘리지 않게 ✂️커팅 여유분(예: 5cm)을 설정하세요. 한 장씩 미리 잘려있는 <strong>'컷 리본'</strong>이라면 커팅 여유분이 필요 없습니다.</li>
                <li><strong className="text-slate-200">내 매장 프린터 연결:</strong> 출력 프린터 메뉴에서 현재 연결된 엡손 프린터를 선택하고, 인쇄 품질(고속/고급)을 고르세요.</li>
              </ul>
            </div>
          </section>

          {/* Step 2 */}
          <section className="bg-slate-900/50 p-6 rounded-xl border-t-4 border-slate-700 hover:border-emerald-500 transition-colors">
            <h3 className="text-xl font-bold text-emerald-400 mb-3 flex items-center gap-2">
              <span className="bg-emerald-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">2</span> 
              리본에 글씨 적기 & 폰트 마법사
            </h3>
            <div className="space-y-3 text-slate-300 ml-9">
              <p>본격적으로 화환에 들어갈 글씨를 입력하고 예쁘게 단장하는 단계입니다.</p>
              <ul className="list-disc list-outside ml-5 space-y-2 text-sm leading-relaxed text-slate-400 mt-2">
                <li><strong className="text-slate-200">입력칸 분리:</strong> 위쪽 텍스트 창에는 <strong>'경조사(좌측 리본)'</strong>를, 아래쪽 텍스트 창에는 <strong>'보내는 이(우측 리본)'</strong>를 따로따로 적어주시면 됩니다.</li>
                <li><strong className="text-blue-300">자주 쓰는 문구 원클릭:</strong> 매번 번거롭게 타이핑하지 마세요. 화면 하단 <strong>'상용구 뱅크'</strong>에서 祝發展(축발전) 등을 한 번만 클릭하면 텍스트 창에 쏙 들어갑니다!</li>
                <li><strong className="text-slate-200 flex items-center gap-1 mt-1"><PenTool className="w-4 h-4 text-emerald-400"/> 폰트 마법사 (핵심!):</strong> 한글, 한자, 영문의 글씨체를 각각 다르게 설정해 가장 고급스러운 리본을 만들어보세요. (예: 한자는 붓글씨체, 한글은 굵은 명조체)</li>
                <li>필요시 <Settings className="w-3 h-3 inline"/> (스패너 아이콘)을 눌러 디자인 회사의 전용 폰트나 내가 좋아하는 웹 폰트를 자유롭게 추가할 수 있습니다.</li>
              </ul>
            </div>
          </section>

          {/* Step 3 */}
          <section className="bg-slate-900/50 p-6 rounded-xl border-t-4 border-slate-700 hover:border-amber-500 transition-colors">
            <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
              <span className="bg-amber-500 text-slate-900 rounded-full w-7 h-7 flex items-center justify-center text-sm">3</span> 
              전문가 비밀 스킬: 디자인 마법 (7대 법칙)
            </h3>
            <div className="space-y-3 text-slate-300 ml-9">
              <p>텍스트 입력창에 그냥 타이핑하기만 하면 알아서 디자인이 맞춰지는 마법의 특수 문법들입니다!</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-800 p-5 rounded-lg border border-slate-600 shadow-md">
                  <h4 className="text-white text-base font-bold mb-2 flex items-center gap-2">
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-amber-400 text-sm">[ ]</span> 1칸 압축하기
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">글자 수가 많아 옆으로 삐져나갈 때 사용합니다.</p>
                  <div className="bg-slate-900 p-2 rounded text-sm font-mono text-emerald-300 border border-slate-700/50">
                    입력: <span className="text-white">祝 [홍길동]</span><br/>
                    효과: 홍길동 세 글자가 한 칸 크기에 쏙!
                  </div>
                </div>
                
                <div className="bg-slate-800 p-5 rounded-lg border border-slate-600 shadow-md">
                  <h4 className="text-white text-base font-bold mb-2 flex items-center gap-2">
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-amber-400 text-sm">[ / ]</span> 2줄로 나누기
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-2">동호회, 직함 등 소속이 길 때 오른쪽/왼쪽 두 줄로 나눕니다.</p>
                  <div className="bg-slate-900 p-2 rounded text-sm font-mono text-emerald-300 border border-slate-700/50">
                    입력: <span className="text-white">[대한협회/회장] 홍길동</span><br/>
                    효과: 대한협회와 회장이 위아래 두 줄로 겹쳐짐!
                  </div>
                </div>

                <div className="bg-slate-800 p-5 rounded-lg border border-slate-600 shadow-md">
                  <h4 className="text-white text-base font-bold mb-2">👆 영어/숫자 눕히기 (클릭)</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">프리뷰 화면(우측 캔버스)에 둥둥 떠있는 영어 단어나 숫자 "1,2,3" 을 마우스로 <strong>그냥 클릭</strong> 해보세요! 똑바로 서있던 글씨가 90도로 휙 누웠다가 다시 섭니다.</p>
                </div>

                <div className="bg-slate-800 p-5 rounded-lg border border-slate-600 shadow-md">
                  <h4 className="text-white text-base font-bold mb-2">(주) 전각 문자 보정</h4>
                  <p className="text-xs text-slate-400 leading-relaxed"><code>(주)홍길동상사</code> 라고 회사 특수문자를 적어보세요. 괄호가 보기에 안 예쁘다구요? 걱정 마세요. 화면에서는 시스템이 가장 예쁜 정방형 기호로 자동 보정해줍니다.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Step 4 */}
          <section className="bg-slate-900/50 p-6 rounded-xl border-t-4 border-slate-700 hover:border-indigo-500 transition-colors">
            <h3 className="text-xl font-bold text-indigo-400 mb-3 flex items-center gap-2">
              <span className="bg-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">4</span> 
              만든 템플릿 저장하기 및 출력
            </h3>
            <div className="space-y-3 text-slate-300 ml-9">
              <ul className="list-disc list-outside ml-5 space-y-3 text-sm leading-relaxed text-slate-400">
                <li><strong className="text-white">템플릿 영구 보관 (TEMPLATES):</strong> 화면 정중앙 하단에 떠 있는 버튼들 중 <strong>[Templates]</strong> 버튼을 누르세요. 지금 기가 막히게 세팅해둔 폰트 굵기, 간격, 레이아웃을 '친구 결혼식 양식' 같은 이름으로 평생 저장해 두고 클릭 한 번에 불러올 수 있습니다.</li>
                <li><strong className="text-blue-400">즉시 인쇄 (PRINT):</strong> 모든 준비가 끝났다면 제일 큰 파란색 <strong>[PRINT]</strong> 버튼을 누르세요. 현장 엡손 프린터에서 즉시 출력을 시작합니다!</li>
                <li><strong className="text-red-400">❗ 알림:</strong> 현재 접속하신 <span className="underline">무료 체험 형태</span>에서는 보안상 PRINT(출력)와 TEMPLATES(저장) 버튼이 작동하지 않습니다. 1분 만에 회원가입을 마치시고 이 모든 기능을 즐겨보세요!</li>
              </ul>
            </div>
          </section>

          {/* Section 5 (Hotline) */}
          <section className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
              <span role="img" aria-label="headset">🎧</span> 5. 고객센터 및 1:1 Q&A 안내
            </h3>
            <div className="space-y-4 text-slate-300">
              <p>기기 사용 중 장애가 발생하거나, 구독 연장 등 각종 문의 사항이 있으시다면 언제든지 아래 핫라인으로 연락해 주시기 바랍니다.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-blue-500/30">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-900/50 p-2 rounded-full text-2xl">📞</div>
                    <div>
                      <h4 className="font-semibold text-white">전화 상담</h4>
                      <p className="text-sm text-slate-400">평일 09:00 - 18:00 (주말 불가)</p>
                    </div>
                  </div>
                  <div className="text-blue-400 font-extrabold text-xl font-mono">1588-0000</div>
                </div>

                <div className="bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-amber-500/30 hover:bg-slate-700/80 cursor-pointer transition">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-900/50 p-2 rounded-full text-2xl">💬</div>
                    <div>
                      <h4 className="font-semibold text-white">카카오톡 1:1 문의</h4>
                      <p className="text-sm text-slate-400">24시간 질문 접수 가능</p>
                    </div>
                  </div>
                  <div className="text-amber-400 font-bold">@ribbonprint</div>
                </div>
              </div>

              <div className="text-sm mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <p>일반 에러나 버그 신고는 카카오톡으로 화면 스크린샷과 함께 보내주시면 가장 빠르게 해결해 드릴 수 있습니다.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
