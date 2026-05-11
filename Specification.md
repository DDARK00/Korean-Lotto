🏗️ Lotto Wasm Project Blueprint
본 프로젝트는 GitHub Actions를 통한 데이터 자동 수집 파이프라인과 WebAssembly(Wasm) 기반의 고속 연산 엔진을 결합한 차세대 로또 분석 플랫폼입니다.

📁 Project Directory Structure
```Plaintext
root/
├── .github/
│   └── workflows/
│       └── update-lotto.yml      # GitHub Actions 워크플로우 정의
├── config/
│   └── api_info.json             # API 엔드포인트 및 설정 상수
├── data/
│   └── history.json              # [Source] 원본 로또 당첨 데이터 (JSON)
├── script/                       # [Python] 데이터 가공 및 보안 파이프라인
│   ├── main.py                   # 공정 통합 관리 및 실행 (Manager)
│   ├── collector.py              # API 수집 및 JSON 증분 업데이트
│   ├── processor.py              # 비트셋 변환 및 C++ 헤더 생성
│   └── signer.py                 # Secrets 기반 Ed25519 서명 로직
├── wasm/                         # [C++] 고속 연산 엔진
│   ├── src/
│   │   ├── main.cpp              # 로또 비교 및 당첨 판별 로직
│   │   ├── monocypher.c          # 추가: 소스 파일 관리
│   │   ├── monocypher.h
│   │   └── lotto_data.h          # [Generated] 서명된 비트셋 데이터 헤더
│   └── build/                    # 로컬 테스트용 빌드 폴더 (유지)접점 파일
│       ├── engine.js             # 컴파일된 .wasm 및 .js 
│       └── engine.wasm
└── fe/                           # [Frontend] 사용자 인터페이스
    └── react etc...
```

🛠️ Work Pipeline & Logic Flow
1. Data Collection Phase (Python)
  Incremental Update: 기존 history.json의 마지막 회차를 인식하여 누락된 최신 회차만 수집합니다.

- Politeness Strategy: 초기 대량 수집(1~1,200회)은 로컬에서 수행 후 커밋하며, 자동화 공정에서는 time.sleep을 적용하여 서버 부하를 최소화합니다.

2. Processing & Security Phase (Python)
Bitset Compression: 6개의 번호를 uint64_t 정수의 비트 필드에 매핑하여 메모리 점유율을 줄이고 연산 속도를 극대화합니다.

- Cryptographic Signing: GitHub Secrets의 Private Key를 사용하여 비트셋 바이너리의 해시값을 Ed25519 방식으로 서명합니다.

- Code Generation: Wasm 컴파일 단계에서 즉시 참조 가능한 정적 배열 형태의 lotto_data.h를 자동 생성합니다.

3. Wasm Engine Build (C++)
Integrity Check: 엔진 구동 시 내장된 Public Key로 데이터의 서명을 검증하여 위변조를 차단합니다.

  - High-Speed Matching: Bitwise AND 및 popcount 알고리즘을 사용하여 수천 회차의 대조 작업을 밀리초(ms) 단위로 처리합니다.

- Emscripten Build: 최적화된 C++ 로직을 웹 브라우저 호환 바이너리로 빌드합니다.

4. Integration & UI (JS/HTML)
Wasm Bridge: JS와 Wasm 간의 메모리 공유 및 함수 호출 인터페이스를 구성합니다.

- Data Visualization: 가공된 JSON을 활용해 회차별 통계 및 상세 정보를 미려하게 시각화합니다.

5. Automation (GitHub Actions)
Scheduled Trigger: 매주 토요일 당첨 발표 직후 정기적으로 실행됩니다.

- Auto-Commit: 업데이트된 데이터와 빌드된 바이너리를 리포지토리에 자동 푸시하여 최신 상태를 유지합니다.

🔐 Security Policy
Secrets Management: 서명용 개인키는 코드에 노출하지 않으며 오직 GitHub Secrets 환경 변수로만 주입받습니다.

- Data Integrity: 데이터 위변조가 감지될 경우 Wasm 엔진은 연산을 거부하거나 무효화된 시그니처를 반환하여 신뢰성을 보장합니다.

🚀 Step-by-Step Task Checklist  

[x] Phase 1: 로컬에서 1회~현재 회차까지 history.json 초기 수집 및 저장소 구축

[x] Phase 2: collector.py (JSON 갱신) 및 processor.py (비트셋 변환) 모듈 구현

[x] Phase 3: signer.py (Ed25519 서명) 구현 및 main.py 통합 공정 조립

[x] Phase 4: C++ Wasm 연산 로직 개발 및 서명 검증 엔진 구현

[ ] Phase 5: GitHub Actions YAML 작성 및 Secrets 환경 변수 설정

[ ] Phase 6: Frontend UI 개발 및 Wasm JS 브릿지 연결

[ ] Phase 7: 전체 파이프라인 통합 테스트 및 데이터 정합성 검증