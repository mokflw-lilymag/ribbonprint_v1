# 🚀 Ribbon Printer Bridge Engine Roadmap (v15.6+)

사용자님의 피드백과 향후 고도화 계획을 담은 공식 타스크 리스트입니다.

---

## 📅 향후 최우선 작업 리스트 (Priority Tasks)

### 1. 리본 미디어 타입 정밀 제어 (Media Type Control) 🔄📄
- [ ] **롤 리본 (Roll Ribbon)**:
    - 드라이버 레벨의 자동 절단(Auto-Cut) 명령 연동 연구.
    - 연속 인쇄 시 용지 피딩(Feeding) 최적화 로직 구현.
- [ ] **컷 리본 (Cut Ribbon)**:
    - 낱장 공급 시 발생하는 센서 오류 방지 로직 (GDI 세션 지연처리).
    - 수동 급지 대기 모드 구현.

### 2. 인쇄 품질 및 속도 가변 제어 (Speed/Quality Control) ⚡💎
- [ ] **고속 인쇄 (Fast Mode)**:
    - 저해상도(300dpi 수준) DPI 강제 설정을 통한 출력 속도 극대화.
    - 데이터 전송 페이로드 최적화.
- [ ] **고급 인쇄 (High-Quality Mode)**:
    - 고해상도(600dpi 이상) DPI 설정 및 안티앨리어싱(Smoothing) 강화.
    - 글씨 및 이미지 경계선(Halftone) 개선.

---

## ✅ 완료된 주요 기능 (Recent Accomplishments)
- [x] **v15.6 GDI 엔진**: 엡손 M105 무제한 가변 높이 출력 성공 (`RawKind=256`).
- [x] **분절 가이드선 기능**: 리본 연결 부위에 1mm 가이드 라인 삽입 로직 구현.
- [x] **브릿지 자동 업데이트**: 웹 접속 시 로컬 브릿지 버전 체크 및 설치 안내 모달 연동.
- [x] **사이드바 최적화**: 사용자 워크플로우를 반영한 메뉴 재배치 및 로고 섹션 통합.

---

## 🛠️ 기술적 참고 사항 (Technical Notes)
- **대상 기종**: Epson M105 (GDI 계열)
- **핵심 기술**: PowerShell Grid-Based Printing / Win32 GDI API
- **브릿지 버전**: v15.6 (Stable)
