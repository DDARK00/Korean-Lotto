import { useState, useEffect, useCallback, useRef } from 'react'
import type { LottoHistory, LottoResult, CheckResult, ResultSummary } from '@lib/types'
import { getWinningNumbers, calculateRank } from '@lib/types'

// Emscripten Module 타입
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
  mod: EmscriptenModule,
  startFn: (ptr: number) => number,
  userNumbers: number[]
): Promise<CheckResult | null> {
  const ptr = mod._malloc(6 * 4)

  try {
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
  const moduleRef = useRef<EmscriptenModule | null>(null)
  const startSimulationRef = useRef<((ptr: number) => number) | null>(null)

  // 현재 status 저장용 ref
  const statusRef = useRef<WasmStatus>('loading')

  // status 변경될 때 ref 동기화
  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    let isMounted = true
    const loadWasm = async () => {
      try {
        // Module 객체 초기화
        const moduleConfig = {
          onRuntimeInitialized: () => {
            const mod = window.Module
            moduleRef.current = mod
            
            // cwrap으로 start_simulation 함수 래핑
            // 비트셋(메모리) 포인터를 받아서 처리
            startSimulationRef.current = mod.cwrap(
              'start_simulation',
              'number',
              ['number']  // 비트셋 포인터
            )
            
            if (isMounted) {
              setStatus('ready')
            }
          },
        }

        // 기존 Module이 있으면 병합
        if (window.Module) {
          Object.assign(window.Module, moduleConfig)
        } else {
          window.Module = moduleConfig as EmscriptenModule
        }

        // engine.js 스크립트 로드
        const existingScript = document.querySelector('script[src="/wasm/engine.js"]')
        if (!existingScript) {
          const script = document.createElement('script')
          script.src = '/wasm/engine.js'
          script.async = true
          script.onerror = () => {
            if (isMounted) {
              setError('WASM 스크립트 로드 실패')
              setStatus('error')
            }
          }
          document.head.appendChild(script)
        }


      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'WASM 로드 중 오류 발생')
          setStatus('error')
        }
      }
    }
    // 10초 타임아웃
    const timer=setTimeout(() => {
      if (!isMounted) return

      if (statusRef.current === 'loading') {
        setError('WASM 모듈 초기화 시간 초과')
        setStatus('error')
      }
    }, 10000)
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
