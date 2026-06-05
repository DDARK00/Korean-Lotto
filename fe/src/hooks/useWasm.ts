import { useState, useEffect, useCallback, useRef } from 'react'
import type { LottoHistory, LottoResult, CheckResult, ResultSummary } from '@lib/types'
import { getWinningNumbers, calculateRank } from '@lib/types'
import wasmUrl from '../wasm/engine.wasm?url';
// Emscripten Module 타입
import createModule, { WasmEngineModule } from '../wasm/engine.js';

interface EmscriptenModule {
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  HEAP32: Int32Array
  cwrap: (name: string, returnType: string | null, argTypes: string[]) => (...args: number[]) => number
  onRuntimeInitialized?: () => void
}

declare global {
  interface Window {
    Module: EmscriptenModule
  }
}

type WasmStatus = 'loading' | 'ready' | 'error'

interface UseWasmReturn {
  status: WasmStatus
  error: string | null
  checkNumbers: (numbers: number[]) => Promise<CheckResult | null>
}

// 히스토리 데이터 캐시
let historyDataCache: LottoHistory[] | null = null

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
async function computeJS(userNumbers: number[]): Promise<CheckResult> {
  const history = await loadHistoryData()

  const results: LottoResult[] = history.map((draw) => {
    const winningNumbers = getWinningNumbers(draw)

    const matchedNumbers = userNumbers.filter(n =>
      winningNumbers.includes(n)
    )

    const matchCount = matchedNumbers.length
    const hasBonusMatch = userNumbers.includes(draw.bnsWnNo)
    const rank = calculateRank(matchCount, hasBonusMatch)

    return {
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
    }
  })

  const summary: ResultSummary = {
    total: results.length,
    firstPlace: results.filter(r => r.rank === 1).length,
    secondPlace: results.filter(r => r.rank === 2).length,
    thirdPlace: results.filter(r => r.rank === 3).length,
    fourthPlace: results.filter(r => r.rank === 4).length,
    fifthPlace: results.filter(r => r.rank === 5).length,
  }

  return {
    userNumbers,
    results: results.sort((a, b) => b.round - a.round),
    summary,
  }
}

/* =========================
 * WASM ENGINE (minimal)
 * ========================= */
async function computeWASM(
  mod: WasmEngineModule,
  startFn: (ptr: number) => number,
  userNumbers: number[]
): Promise<CheckResult | null> {
  const ptr = mod._malloc(6 * 4)

  try {
    console.log(mod)
    mod.HEAP32.set(userNumbers, ptr >> 2)

    const status = startFn(ptr)

    if (status !== 0) {
      throw new Error(`WASM error: ${status}`)
    }

    // 👉 현재 구조에서는 WASM 결과를 JS로 재계산한다고 가정
    return computeJS(userNumbers)

  } finally {
    mod._free(ptr)
  }
}


export function useWasm(): UseWasmReturn {
  const [status, setStatus] = useState<WasmStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const moduleRef = useRef<WasmEngineModule | null>(null)
  const startSimulationRef = useRef<((ptr: number) => number) | null>(null)

  // 현재 status 저장용 ref
  const statusRef = useRef<WasmStatus>('loading')

  // status 변경될 때 ref 동기화
  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    let isMounted = true
    let timer: number;
    const loadWasm = async () => {
      try {
        // 10초 타임아웃 타이머
        timer = setTimeout(() => {
        if (isMounted && moduleRef.current === null) {
          setError('WASM 모듈 초기화 시간 초과');
          setStatus('error');
        }
      }, 10000);


        // Module 객체 초기화
        const mod = await createModule({
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) return wasmUrl;
          return path;
        }
      });
      if (!isMounted) return;

      // 모듈 저장 및 cwrap 함수 래핑
      moduleRef.current = mod;
      startSimulationRef.current = mod.cwrap(
        'start_simulation',
        'number', // 리턴 타입
        ['number'] // 인자 타입 (비트셋 포인터)
      );

      setStatus('ready');
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'WASM 로드 중 오류 발생')
          setStatus('error')
        }
      }
    }
    // 10초 타임아웃
    // const timer=setTimeout(() => {
    //   if (!isMounted) return

    //   if (statusRef.current === 'loading') {
    //     setError('WASM 모듈 초기화 시간 초과')
    //     setStatus('error')
    //   }
    // }, 10000)
    loadWasm()

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

        if (status === 'ready' && mod && wasmFn) {
          return await computeWASM(mod, wasmFn, numbers)
        }

        return await computeJS(numbers)
      } catch (err) {
        console.error('checkNumbers error:', err)
        return await computeJS(numbers)
      }
    },
    [status]
  )
  

  return { status, error, checkNumbers }
}
