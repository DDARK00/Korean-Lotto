# 로또 당첨 확인기

> **만약 이 번호를 계속 샀다면?**
> 내 번호 6개를 1회부터 최신 회차까지 전부 대조해 보는 웹 서비스

**[사이트 바로가기](https://ddark00.github.io/Korean-Lotto)**

번호를 고르면 역대 모든 회차의 당첨 결과를 한 번에 보여줍니다. 대조 연산은 C++로 작성해 WebAssembly로 컴파일한 엔진이 브라우저에서 처리하고, 당첨 데이터는 매주 GitHub Actions가 자동으로 수집합니다. 엔진은 데이터가 위변조되지 않았는지 서명으로 검증한 뒤에만 연산합니다.

## 주요 기능

- **역대 당첨 대조**: 1회~최신 회차 전체를 대조해 등수별 횟수, 누적 당첨금, 회차별 내역(등수 필터)을 보여줍니다.
- **한 끗 차이**: 각 번호를 ±1씩 옮긴 조합(최대 3⁶ = 729개)을 전 회차와 대조해, "옆 번호였다면" 얼마였을지 보여줍니다. 계산량이 커서 WASM 엔진에서만 동작합니다.
- **엔진 교차 검증 도구**: WASM 엔진과 JS 엔진의 결과가 100% 같은지 확인하고 속도를 비교합니다. (데스크톱, 우측 하단 🔬 버튼)
- **JS 폴백**: WASM을 불러오지 못하면 같은 로직의 JS 엔진으로 기본 대조를 계속합니다.
- 라이트/고대비 테마, 모바일 대응, 시맨틱 마크업, 오픈그래프(SNS 공유 미리보기)

## 동작 구조

```
[GitHub Actions: 매주 토요일 추첨 후]
  동행복권 API ─▶ collector.py  최신 회차 수집 → data/lotto_history.json
                  processor.py  회차별 32바이트 비트셋으로 패킹 + Ed25519 서명 → lotto_data.h
                  builder.py    Emscripten으로 C++ 엔진 빌드 → engine.js / engine.wasm
               ─▶ 변경분 커밋 → GitHub Pages 배포

[브라우저]
  engine.wasm 로드 ─▶ 내장 공개키로 데이터 서명 검증 ─▶ 통과 시에만 연산
                      실패/로드 불가 시 JS 엔진으로 폴백
```

- **비트셋 대조**: 당첨 번호 6개를 `uint64_t` 하나의 비트로 표현하고, `AND` + `popcount`로 맞은 개수를 계산합니다.
- **무결성 검증**: 서명용 개인키는 GitHub Secrets에만 있고, 엔진에는 공개키와 서명만 들어갑니다. 검증에 실패하면 엔진은 연산을 거부합니다.
- 생성물(`lotto_data.h`, `engine.js`, `engine.wasm`)은 로컬에서 커밋하지 않고 CI에서만 생성합니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Engine | C++ → WebAssembly (Emscripten), Monocypher (Ed25519) |
| Pipeline | Python (requests, PyNaCl) |
| CI/CD | GitHub Actions, GitHub Pages |

## 프로젝트 구조

```
.
├── .github/workflows/
│   ├── lotto-update.yaml   # 주간 수집 → 헤더 생성 → WASM 빌드 → 커밋 → 배포
│   └── deploy.yaml         # FE 빌드 및 GitHub Pages 배포
├── script/                 # [Python] 데이터 파이프라인
│   ├── main.py             # 파이프라인 진입점
│   ├── collector.py        # API 수집 (최신 회차만 증분)
│   ├── processor.py        # 비트셋 패킹 + 서명 → C++ 헤더 생성
│   └── builder.py          # Emscripten 빌드
├── data/                   # 원본 당첨 데이터 (JSON)
├── wasm/src/               # [C++] 대조 엔진
│   ├── LottoEngine.*       # 서명 검증 게이트 + 회차 대조 / 한 끗 차이 집계
│   ├── LottoCombinator.*   # ±1 조합 생성
│   ├── wasm_entry.cpp      # JS로 노출하는 C 바인딩
│   └── monocypher*         # Ed25519 라이브러리 (vendored)
└── fe/src/                 # [React] 화면
    ├── pages/Checker/      # 메인 페이지
    ├── components/         # 번호 입력, 결과 카드, 한 끗 차이 카드, 테마 토글
    ├── hooks/              # useWasm (엔진 로드·호출), 교차 검증 도구
    ├── lib/engine/         # JS 엔진 / WASM 호출부
    └── wasm/               # CI가 생성한 engine.js / engine.wasm
```

## 로컬 실행

```bash
cd fe
pnpm install
pnpm dev
```

엔진을 다시 빌드하려면 Emscripten과 서명 키(`LOTTO_PRIVATE_KEY`, `SEC_KEY`)가 필요하므로, 엔진 변경은 `main`에 push해 CI로 빌드합니다. (`wasm/src`, `script` 변경 시 자동 재빌드·배포, Actions에서 수동 실행도 가능)
