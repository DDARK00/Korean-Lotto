import { useState, useEffect, useCallback, useRef } from 'react'
import type { LottoHistory, LottoResult, CheckResult, ResultSummary, PrizeSummary } from '@lib/types'
import { getWinningNumbers, calculateRank } from '@lib/types'
import wasmUrl from '../wasm/engine.wasm?url';
import createModule, { WasmEngineModule } from '../wasm/engine.js';

type WasmStatus = 'loading' | 'ready' | 'error'

interface UseWasmReturn {
  status: WasmStatus
  error: string | null
  checkNumbers: (numbers: number[]) => Promise<CheckResult | null>
  _rawWasmContext: {
    mod:WasmEngineModule|null
    wasmFn:((userBitset: bigint, outPtr: number) => number) | null
  }
}

// 히스토리 데이터 캐시
let historyDataCache: LottoHistory[] | null = null

/*
c++ 구조체 타입
#pragma pack(push, 1)
struct LottoRecord {
    uint64_t bitset;
    uint64_t winAmt1;
    uint64_t winAmt2;
    uint64_t winAmt3;
};

// JS로 넘겨줄 필터링된 결과 구조체 (8바이트)
struct MatchResult {
    uint32_t episode;    // 회차
    uint8_t match_count; // 맞은 개수
    uint8_t has_bonus;   // 보너스 여부 (1 or 0)
    uint16_t rank;       // 등수 (1~5)
};
#pragma pack(pop)

*/

async function loadHistoryData(): Promise<LottoHistory[]> {
  if (historyDataCache) return historyDataCache

  const response = await fetch('/data/lotto_history.json')
  if (!response.ok) {
    throw new Error('히스토리 데이터를 불러올 수 없습니다.')
  }
  historyDataCache = await response.json()
  return historyDataCache!
}

/* =========================
 * JS ENGINE (fallback)
 * ========================= */
export async function computeJS(userNumbers: number[]): Promise<CheckResult> {
  const history = await loadHistoryData()

  const prizes: PrizeSummary = {
    first: 0,
    second: 0,
    third: 0,
    fourth: 0,
    fifth: 0,
    total: 0
  }

  const RANK_KEYS: (keyof Omit<PrizeSummary, 'total'>)[] = [
    'first',  // 1등
    'second', // 2등
    'third',  // 3등
    'fourth', // 4등
    'fifth'   // 5등
  ];

  const results: LottoResult[]=[]
  for (let i = 0; i < history.length; i++) {
    let draw=history[i]
    
    const winningNumbers = getWinningNumbers(draw)

    const matchedNumbers = userNumbers.filter(n =>
      winningNumbers.includes(n)
    )

    const matchCount = matchedNumbers.length
    const hasBonusMatch = userNumbers.includes(draw.bnsWnNo)
    const rank = calculateRank(matchCount, hasBonusMatch)
    if (!rank) continue;

    const amount =
      rank === 1 ? draw.rnk1WnAmt :
        rank === 2 ? draw.rnk2WnAmt :
          rank === 3 ? draw.rnk3WnAmt :
            rank === 4 ? 50000 : 5000;
    const targetKey = RANK_KEYS[rank - 1];

    prizes[targetKey] += amount;
    prizes.total += amount;
    results.push ({
      round: draw.ltEpsd,
      numbers: winningNumbers,
      bonusNumber: draw.bnsWnNo,
      matchCount,
      matchedNumbers,
      hasBonusMatch,
      rank,
      prize1st: draw.rnk1WnAmt,
      prize2nd: draw.rnk2WnAmt,
      prize3rd: draw.rnk3WnAmt,
    })
  }

  const summary: ResultSummary = {
    total: history.length,
    firstPlace: results.filter(r => r.rank === 1).length,
    secondPlace: results.filter(r => r.rank === 2).length,
    thirdPlace: results.filter(r => r.rank === 3).length,
    fourthPlace: results.filter(r => r.rank === 4).length,
    fifthPlace: results.filter(r => r.rank === 5).length,
    prizes
  }

  return {
    userNumbers,
    results: results.sort((a, b) => b.round - a.round),
    summary,
  }
}

/* =========================
 * WASM ENGINE (Optimized)
 * ========================= */
export async function computeWASM(
  mod: WasmEngineModule,
  startFn: (userBitset: bigint, outPtr: number) => number,
  userNumbers: number[]
): Promise<CheckResult | null> {
  // 1. 동기화된 히스토리 데이터를 기반으로 정확한 구조체 배열 크기 계산
  const history = await loadHistoryData()
  const totalRounds = history.length

  // MatchResult 구조체 크기: 8바이트 (#pragma pack(1) 규격)
  const structSize = 8
  const outPtr = mod._malloc(totalRounds * structSize)

  try {
    // 2. 유저 번호 배열(number[])을 C++의 uint64_t 비트셋(bigint)으로 변환
    let userBitset = 0n
    userNumbers.forEach(num => {
      userBitset |= (1n << BigInt(num - 1))
    })

    // 3. WASM 함수 실행 (결과 개수가 found_count 반환됨)
    const foundCount = startFn(userBitset, outPtr)

    if (foundCount < 0) {
      throw new Error(`WASM 검증 에러 코드: ${foundCount}`)
    }

    // 4. C++ 결과 메모리 버퍼 파싱 및 JS 결과 구조 매핑
    const results: LottoResult[] = []

    const rawBuffer =
      (mod.HEAPU8 && mod.HEAPU8.buffer) ||
      (mod.HEAP8 && mod.HEAP8.buffer) ||
      (mod.HEAP32 && mod.HEAP32.buffer) ||
      (mod as any).buffer ||
      (mod as any).asm?.memory?.buffer;

    if (!rawBuffer || !(rawBuffer instanceof ArrayBuffer)) {
      throw new Error("WASM 메모리 버퍼(ArrayBuffer)를 찾을 수 없습니다.");
    }


    // 히스토리를 빠르게 조회하기 위해 Map 변환 (WASM 결과 매핑 최적화)
    const historyMap = new Map(history.map(h => [h.ltEpsd, h]))
    const view = new DataView(rawBuffer);

    const prizes: PrizeSummary = {
      first: 0,
      second: 0,
      third: 0,
      fourth: 0,
      fifth: 0,
      total: 0
    }
    const RANK_KEYS: (keyof Omit<PrizeSummary, 'total'>)[] = [
      'first',  // 1등
      'second', // 2등
      'third',  // 3등
      'fourth', // 4등
      'fifth'   // 5등
    ];
    for (let i = 0; i < foundCount; i++) {
      // 현재 구조체가 시작되는 정확한 절대 바이트 위치 (포인터 시작점 + 오프셋)
      const byteOffset = outPtr + (i * structSize);

      // 2. DataView를 이용해 바이트 오프셋 기준으로 정확하게 값 추출
      // 세 번째 인자 true는 Emscripten(WASM)의 Little-Endian 방식을 따르겠다는 의미입니다.
      const round = view.getUint32(byteOffset, true);         // 처음 4바이트 (uint32_t)
      const matchCount = view.getUint8(byteOffset + 4);            // 5번째 바이트 (uint8_t)
      const hasBonusVal = view.getUint8(byteOffset + 5);            // 6번째 바이트 (uint8_t)
      const rank = view.getUint16(byteOffset + 6, true);     // 마지막 2바이트 (uint16_t)

      const draw = historyMap.get(round);
      if (!draw) continue;

      const winningNumbers = getWinningNumbers(draw);
      const amount =
        rank === 1 ? draw.rnk1WnAmt :
          rank === 2 ? draw.rnk2WnAmt :
            rank === 3 ? draw.rnk3WnAmt :
              rank === 4 ? 50000 : 5000;
      const targetKey = RANK_KEYS[rank - 1];
      prizes[targetKey] += amount;
      prizes.total += amount;

      results.push({
        round,
        numbers: winningNumbers,
        bonusNumber: draw.bnsWnNo,
        matchCount,
        matchedNumbers: userNumbers.filter(n => winningNumbers.includes(n)),
        hasBonusMatch: hasBonusVal === 1,
        rank,
        prize1st: draw.rnk1WnAmt,
        prize2nd: draw.rnk2WnAmt,
        prize3rd: draw.rnk3WnAmt,
      });
    }

    const summary: ResultSummary = {
      total: history.length,
      firstPlace: results.filter(r => r.rank === 1).length,
      secondPlace: results.filter(r => r.rank === 2).length,
      thirdPlace: results.filter(r => r.rank === 3).length,
      fourthPlace: results.filter(r => r.rank === 4).length,
      fifthPlace: results.filter(r => r.rank === 5).length,
      prizes
    }

    return {
      userNumbers,
      results: results.sort((a, b) => b.round - a.round),
      summary,
    }

  } finally {
    // 5. 메모리 할당 해제 (누수 방지 필수)
    mod._free(outPtr)
  }
}

/* =========================
 * MAIN CUSTOM HOOK
 * ========================= */
export function useWasm(): UseWasmReturn {
  const [status, setStatus] = useState<WasmStatus>('loading')
  const [error, _] = useState<string | null>(null)

  const moduleRef = useRef<WasmEngineModule | null>(null)
  const startSimulationRef = useRef<((userBitset: bigint, outPtr: number) => number) | null>(null)
  const statusRef = useRef<WasmStatus>('loading')

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    let isMounted = true
    let timer:ReturnType<typeof setTimeout>

    const initWasm = async () => {
      try {
        // 10초 타임아웃 타이머
        timer = setTimeout(() => {
          if (isMounted && moduleRef.current === null) {
            console.warn('WASM 초기화 시간 초과 - JS Fallback 모드로 작동합니다.')
            setStatus('error') // 사용자 UI 진입을 위해 error 처리 후 JS 대체 유도
          }
        }, 10000)

        // Module 객체 초기화 및 Vite 번들 경로 바인딩
        const mod = await createModule({
          locateFile: (path: string) => {
            if (path.endsWith('.wasm')) return wasmUrl
            return path
          }
        })

        if (!isMounted) return
        clearTimeout(timer)

        moduleRef.current = mod

        // 🌟 C++ 명세에 따른 cwrap 입력/리턴 타입 재교정
        startSimulationRef.current = mod.cwrap(
          'start_simulation',
          'number',            // 리턴 타입: found_count (int)
          ['bigint', 'number']  // 인자 타입: [user_bitset(uint64_t), out_results(포인터)]
        )

        setStatus('ready')
      } catch (err) {
        console.error('WASM 모듈 로드 실패, JS 모드로 자동 대체됩니다:', err)
        if (isMounted) {
          clearTimeout(timer)
          setStatus('error') // 에러로 Fallback 구동 환경 제공
        }
      }
    }

    initWasm()

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [])

  /* =========================
   * SINGLE ENTRY POINT
   * ========================= */
  const checkNumbers = useCallback(
    async (numbers: number[]): Promise<CheckResult | null> => {
      try {
        const mod = moduleRef.current
        const wasmFn = startSimulationRef.current

        // WASM 모듈과 래퍼 함수가 확실히 바인딩되었을 때만 WASM 작동
        if (statusRef.current === 'ready' && mod && wasmFn) {
          console.log('🚀 Running with WASM core engine')
          return await computeWASM(mod, wasmFn, numbers)
        }

        // 초기화 실패 혹은 로딩 중일 시 안전하게 JS 엔진 실행
        console.log('⚡ Running with JavaScript fallback engine')
        return await computeJS(numbers)
      } catch (err) {
        console.error('checkNumbers error (switched to JS):', err)
        return await computeJS(numbers)
      }
    },
    [] // status 종속성을 제거하여 불필요한 함수 재생성 억제 및 안정성 확보
  )

  return { status, error, checkNumbers,
    _rawWasmContext: moduleRef.current && startSimulationRef.current ? { mod: moduleRef.current, wasmFn: startSimulationRef.current } : {mod:null,wasmFn:null}
   }
}