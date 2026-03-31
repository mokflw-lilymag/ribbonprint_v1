# [Implementation Plan] XPrinter(Xprinter) 감열식 프린터 통합 개발 계획

## 1. 개요 (Overview)

### 1-1. 목표
현재 **Epson M105 전용**으로 동작하는 리본 프린트 시스템에 **Xprinter 계열 감열식/열전사 프린터**를 추가 지원하여, 사용자가 프린터 선택 드롭다운에서 원하는 프린터를 골라 즉시 인쇄할 수 있도록 한다.

### 1-2. 배경
- **Xprinter(엑스프린터)**: 중국 Zhuhai Xprinter Technology에서 제조하는 감열식/열전사 POS 프린터 브랜드
- **주요 모델**: XP-Q800, XP-TT428B, XP-TT434B 등
- **제어 방식**: ESC/POS 명령어 세트 기본 지원 (Epson 호환)
- **인터페이스**: USB, RS-232, LAN, Bluetooth, Wi-Fi (모델별 상이)
- **해상도**: 203 DPI (8 dots/mm)
- **인쇄 폭**: 58mm / 80mm / 108mm (모델별)
- **자동 커터**: 모델에 따라 전체/부분 절단 지원

### 1-3. 감열식 vs 열전사 — 꽃집 리본 인쇄에서의 차이

| 구분 | 감열식 (Direct Thermal) | 열전사 (Thermal Transfer) |
|------|------------------------|--------------------------|
| 원리 | 열에 반응하는 특수 용지에 직접 인쇄 | 리본(먹지)을 녹여 대상에 전사 |
| 리본(먹지) 필요? | ❌ 불필요 | ✅ 필수 |
| 공단 리본 인쇄 | ❌ 불가 | ✅ 가능 |
| 내구성 | 시간이 지나면 변색/지워짐 | 반영구적 |
| 꽃집 사용 | 영수증·라벨 용도로만 사용 | **화환 리본 인쇄에 적합** |

> ⚠️ **중요**: 꽃집에서 공단 리본에 경조사 문구를 인쇄하려면 반드시 **열전사(Thermal Transfer)** 방식의 프린터가 필요합니다. Xprinter 모델 중 'TT' 시리즈(XP-TT428B, XP-TT434B 등)가 이에 해당합니다.

---

## 2. 현재 시스템 아키텍처 분석

### 2-1. 기존 흐름 (Epson M105)
```
[웹 UI: App.tsx]
    ↓ POST /api/print_image
    ↓ (base64 이미지, 프린터명, 폭, 길이, 마진)
[Bridge Server: bridge_server.js]
    ↓ executePrintJob()
    ↓ printViaGDI()
    ↓ PowerShell → System.Drawing.Printing
[Epson M105 드라이버]
    ↓ GDI 렌더링
[프린터 하드웨어]
```

### 2-2. 핵심 파일 구조
| 파일 | 역할 |
|------|------|
| `bridge_server.js` | Express 서버, 프린터 목록 조회, 인쇄 작업 관리, GDI 엔진 |
| `ribbon_printer.cs` | C# GDI 인쇄 엔진 (독립 실행형) |
| `App.tsx` | 웹 프론트엔드, 프린터 선택 UI, 리본 디자인 에디터 |

### 2-3. 현재 제어 방식의 특징
- **GDI 기반**: Windows System.Drawing.Printing을 사용하여 프린터 드라이버를 통해 인쇄
- **장점**: 프린터 종류에 관계없이 드라이버만 설치되면 동작
- **단점**: 프린터 하드웨어의 저수준 기능(커터, 피딩 제어 등) 활용 불가

---

## 3. Xprinter 통합 전략 — 2가지 접근법

### 접근법 A: GDI 드라이버 방식 (권장 — 즉시 적용 가능)

**원리**: Xprinter의 Windows 드라이버를 설치하면, 기존 GDI 엔진(`printViaGDI`)이 **그대로 동작**합니다.

```
[App.tsx] → [bridge_server.js] → [printViaGDI()] → [Xprinter 드라이버] → [Xprinter 프린터]
```

**장점**:
- 기존 코드 변경 최소화
- 모든 Xprinter 모델에서 즉시 동작
- 폰트 렌더링, 이미지 출력 품질 유지

**단점**:
- 커터 자동 제어 불가 (드라이버 설정에 의존)
- 피딩 정밀 제어 불가

**필요 작업량**: ⭐ 적음 (1~2일)

---

### 접근법 B: ESC/POS 직접 제어 방식 (고급 — 하드웨어 완전 제어)

**원리**: `node-thermal-printer` 또는 `@node-escpos` 라이브러리를 사용하여, 프린터에 ESC/POS 바이트 명령을 직접 전송합니다.

```
[App.tsx] → [bridge_server.js] → [ESC/POS 엔진(NEW)] → [USB 직접 통신] → [Xprinter 프린터]
```

**장점**:
- 커터 자동 제어 (`GS V` 명령)
- 피딩 mm 단위 정밀 제어 (`ESC J` 명령)
- 프린터 상태 실시간 모니터링 (`DLE EOT` 명령)

**단점**:
- 이미지를 ESC/POS 비트맵으로 변환해야 함 (라스터 이미지 → ESC/POS GS v 0)
- 폰트 렌더링을 프린터 내장 폰트에 의존하거나, 이미지로 변환 후 전송
- Windows 드라이버와 충돌 가능 (하나만 USB 점유 가능)
- 프린터 모델별 미세한 명령어 차이 대응 필요

**필요 작업량**: ⭐⭐⭐⭐ 많음 (1~2주)

---

## 4. 권장 구현 계획 (접근법 A 중심 + B 부분 활용)

> **핵심 전략**: 인쇄 자체는 검증된 GDI 엔진을 그대로 활용하되,
> Xprinter 전용 기능(자동 커터, 상태 확인)만 ESC/POS로 보조하는 **하이브리드 방식**

### Phase 1: 프린터 자동 감지 및 분류 시스템 (1일)

#### [MODIFY] `bridge_server.js` — `/api/printers` 엔드포인트 개선

현재 프린터 목록은 이름만 반환합니다. 이를 개선하여 **프린터 타입을 자동 분류**합니다.

```javascript
// 현재
return { name: p.Name, status: statusStr, driver: p.DriverName };

// 개선
return {
  name: p.Name,
  status: statusStr,
  driver: p.DriverName,
  // 자동 분류
  type: classifyPrinter(p.DriverName, p.Name),
  capabilities: getCapabilities(p.DriverName)
};

function classifyPrinter(driver, name) {
  const d = (driver + ' ' + name).toLowerCase();
  if (d.includes('epson') && d.includes('m1')) return 'epson_m105';
  if (d.includes('xprinter') || d.includes('xp-')) return 'xprinter';
  if (d.includes('thermal') || d.includes('pos')) return 'thermal_generic';
  return 'generic';
}

function getCapabilities(driver) {
  const d = driver.toLowerCase();
  return {
    hasCutter: d.includes('xprinter') || d.includes('xp-'),
    maxWidthMM: d.includes('80') ? 80 : d.includes('58') ? 58 : 108,
    dpi: 203,
    supportsESCPOS: d.includes('xprinter') || d.includes('pos')
  };
}
```

#### [MODIFY] `App.tsx` — 프린터 선택 UI에 타입 표시

```tsx
// 기존: 이름만 표시
<option value={p.name}>{p.name}</option>

// 개선: 프린터 타입 아이콘 + 이름
<option value={p.name}>
  {p.type === 'xprinter' ? '🖨️' : '🎀'} {p.name}
</option>
```

---

### Phase 2: GDI 엔진의 Xprinter 호환성 확보 (1일)

#### [MODIFY] `bridge_server.js` — `printViaGDI()` 함수

Xprinter는 Epson과 용지 규격 처리가 다를 수 있으므로, 프린터 타입에 따라 분기합니다.

```javascript
function printViaGDI(printerName, images, widthMM, lengthMM, leftMarginMM, cuttingMarginMM, mediaType, printerType) {
  // Xprinter 전용 설정
  if (printerType === 'xprinter') {
    // Xprinter는 일반적으로 용지 폭이 58mm/80mm 고정
    // 인쇄 영역을 프린터 물리 폭에 맞게 자동 조정
    // Xprinter 드라이버는 A4 고정이 아닌 실제 용지 폭 사용
    // $widthUnits = [int](${actualPrintWidth} / 25.4 * 100)
  }
  // 기존 Epson 로직 유지
  // ...
}
```

**핵심 차이점 대응 목록**:

| 항목 | Epson M105 | Xprinter |
|------|-----------|----------|
| 용지 폭 | A4(210mm) 고정, X좌표로 리본 위치 이동 | 실제 용지 폭 사용 (58/80mm) |
| 용지 길이 | 커스텀 PaperSize 생성 | 동일 |
| 마진 | Margin-as-Center 공식 적용 | X=0부터 시작 (좌측 정렬) |
| 용지 소스 | Roll/Continuous 자동 탐색 | 드라이버 기본값 사용 |

---

### Phase 3: ESC/POS 보조 기능 — 자동 커터 제어 (2일)

#### [NEW] `bridge_server.js` — `cutPaper()` 함수

GDI 인쇄 완료 후, 커터가 장착된 Xprinter에 한해 ESC/POS 명령으로 용지를 잘라줍니다.

```javascript
const net = require('net');

function cutPaper(printerName) {
  return new Promise((resolve, reject) => {
    // Windows에서 프린터 포트 정보 조회
    const portCmd = `powershell "Get-WmiObject Win32_Printer | Where-Object { $_.Name -eq '${printerName}' } | Select-Object -ExpandProperty PortName"`;
    const port = execSync(portCmd, { encoding: 'utf8' }).trim();

    // ESC/POS 커터 명령: GS V 66 3 (부분 절단, 3단계 피드 후)
    const cutCommand = Buffer.from([0x1D, 0x56, 0x42, 0x03]);

    if (port.startsWith('USB')) {
      // USB 프린터: RAW 데이터 전송 (Windows 스풀러 경유)
      const psRaw = `
        $port = (Get-WmiObject Win32_Printer | Where-Object { $_.Name -eq '${printerName}' }).PortName
        $bytes = [byte[]]@(0x1D, 0x56, 0x42, 0x03)
        # RAW printing via .NET
        # ... (생략)
      `;
      // 실행
    } else if (port.match(/\d+\.\d+\.\d+\.\d+/)) {
      // 네트워크 프린터: TCP 소켓으로 직접 전송
      const client = new net.Socket();
      client.connect(9100, port, () => {
        client.write(cutCommand);
        client.end();
        resolve();
      });
    }
  });
}
```

---

### Phase 4: 프론트엔드 프린터 설정 UI 고도화 (1일)

#### [MODIFY] `App.tsx` — 프린터별 설정 패널

```
┌─────────────────────────────────────┐
│ 🖨️ 프린터 선택                      │
│ ┌─────────────────────────────────┐ │
│ │ ▼ EPSON TM-M105 (기본)         │ │
│ │   XPrinter XP-TT434B (USB)     │ │
│ │   XPrinter XP-Q800 (LAN)      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ✅ 감지된 기능:                      │
│   🔪 자동 커터: 지원                 │
│   📏 최대 폭: 108mm                 │
│   ⚡ DPI: 203                       │
│                                     │
│ 📐 프린터별 마진 보정: [+0] mm       │
└─────────────────────────────────────┘
```

---

### Phase 5: 테스트 및 배포 (1일)

- Xprinter 실기 테스트 (드라이버 설치 → GDI 인쇄 → 커터 동작)
- 다양한 리본 폭(38mm~165mm)에서의 출력 정밀도 검증
- 인스톨러 업데이트 (v24.0)

---

## 5. 상세 타스크 리스트

### Phase 1: 프린터 감지 및 분류 (1일)
- [ ] `bridge_server.js`: `classifyPrinter()` 함수 추가 — 드라이버명에서 프린터 타입 자동 분류
- [ ] `bridge_server.js`: `/api/printers` 응답에 `type`, `capabilities` 필드 추가
- [ ] `App.tsx`: 프린터 목록 드롭다운에 타입 아이콘 표시 (🎀 Epson / 🖨️ Xprinter)
- [ ] `App.tsx`: 선택한 프린터의 capabilities 정보를 상태에 저장

### Phase 2: GDI 엔진 Xprinter 호환 (1일)
- [ ] `bridge_server.js`: `printViaGDI()`에 `printerType` 파라미터 추가
- [ ] `bridge_server.js`: Xprinter 전용 용지 규격 계산 로직 분기 (A4 고정 → 실제 폭)
- [ ] `bridge_server.js`: Xprinter 마진 계산 방식 분기 (Margin-as-Center → 좌측 정렬)
- [ ] `App.tsx`: `handlePrint()`에서 프린터 타입 정보를 API payload에 포함

### Phase 3: ESC/POS 보조 기능 (2일)
- [ ] `bridge_server.js`: `cutPaper()` 함수 구현 (ESC/POS GS V 명령)
- [ ] `bridge_server.js`: USB/네트워크 포트 자동 감지 및 RAW 데이터 전송
- [ ] `bridge_server.js`: 인쇄 완료 후 자동 커터 호출 로직 연동
- [ ] `bridge_server.js`: 프린터 상태 확인 API (`/api/printer/status/:name`) 추가

### Phase 4: 프론트엔드 UI 개선 (1일)
- [ ] `App.tsx`: 프린터 선택 시 capabilities 기반 설정 패널 동적 표시
- [ ] `App.tsx`: Xprinter 전용 옵션 (자동 커터 ON/OFF, 마진 보정값)
- [ ] `App.tsx`: 프린터별 마진 보정값을 localStorage에 기억

### Phase 5: 테스트 및 배포 (1일)
- [ ] Xprinter 드라이버 설치 후 GDI 인쇄 테스트
- [ ] 커터 ESC/POS 명령 동작 테스트
- [ ] 다양한 리본 규격에서 출력 정밀도 측정
- [ ] 인스톨러 v24.0 업데이트 및 배포
- [ ] 깃허브 최종 푸시

---

## 6. 리스크 및 주의사항

### 🟢 낮은 리스크
- **GDI 호환성**: Xprinter는 Windows 드라이버를 제공하므로, 기존 GDI 엔진이 99% 그대로 동작할 것으로 예상
- **프린터 목록 감지**: Windows PowerShell `Get-Printer`는 모든 설치된 프린터를 반환하므로 Xprinter도 자동 포함

### 🟡 중간 리스크
- **마진 계산 차이**: Epson M105의 "Margin-as-Center" 방식이 Xprinter에서는 다르게 동작할 수 있음 → 프린터별 보정값 필요
- **용지 폭 차이**: Xprinter는 실제 용지 폭(58/80/108mm)을 사용하지만, 꽃집 리본은 38~165mm까지 다양 → 프린터 물리 폭보다 넓은 리본은 인쇄 불가

### 🔴 높은 리스크
- **ESC/POS USB 충돌**: Windows 드라이버와 직접 USB 제어가 동시에 불가능할 수 있음 → GDI와 ESC/POS를 동시에 사용하려면 인쇄 후 드라이버 해제 → ESC/POS 커터 → 드라이버 재연결 시퀀스 필요
- **열전사 리본(먹지) 호환**: 감열식 전용 모델로는 공단 리본 인쇄가 물리적으로 불가능 → 사용자에게 명확한 프린터 요구사항 안내 필수

---

## 7. 예상 결과물

### 사용자 경험 (최종)
1. Xprinter 드라이버를 설치하고 USB/LAN으로 연결
2. 웹 앱의 프린터 드롭다운에서 `🖨️ XPrinter XP-TT434B` 선택
3. 기존과 동일하게 리본 디자인 후 **인쇄 버튼 클릭**
4. GDI 엔진이 Xprinter 규격에 맞춰 정확하게 출력
5. (옵션) 자동 커터가 인쇄 완료 후 용지를 깔끔하게 절단

---

## 8. 필요 장비 및 준비물
- [ ] Xprinter 열전사 프린터 1대 (권장: XP-TT428B 또는 XP-TT434B)
- [ ] 전용 레진 리본(먹지) 
- [ ] 공단 리본 시험 용지
- [ ] USB 케이블 또는 LAN 케이블
- [ ] Xprinter Windows 드라이버 (공식 사이트: xprintertech.com)
