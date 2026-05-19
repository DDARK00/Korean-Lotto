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
  
  const response = await fetch('/data/history.json')
  if (!response.ok) {
    throw new Error('히스토리 데이터를 불러올 수 없습니다.')
  }
  historyDataCache = await response.json()
  return historyDataCache!
}

export function useWasm(): UseWasmReturn {
  const [status, setStatus] = useState<WasmStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const moduleRef = useRef<EmscriptenModule | null>(null)
  const startSimulationRef = useRef<((ptr: number) => number) | null>(null)

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

        // 10초 타임아웃
        setTimeout(() => {
          if (isMounted && status === 'loading') {
            setError('WASM 모듈 초기화 시간 초과')
            setStatus('error')
          }
        }, 10000)
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'WASM 로드 중 오류 발생')
          setStatus('error')
        }
      }
    }

    loadWasm()

    return () => {
      isMounted = false
    }
  }, [])

  // JavaScript 폴백: WASM 없이 직접 계산
  const checkNumbersJS = useCallback(async (userNumbers: number[]): Promise<CheckResult> => {
    const history = await loadHistoryData()
    
    const results: LottoResult[] = history.map((draw) => {
      const winningNumbers = getWinningNumbers(draw)
      const matchedNumbers = userNumbers.filter((n) => winningNumbers.includes(n))
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
      firstPlace: results.filter((r) => r.rank === 1).length,
      secondPlace: results.filter((r) => r.rank === 2).length,
      thirdPlace: results.filter((r) => r.rank === 3).length,
      fourthPlace: results.filter((r) => r.rank === 4).length,
      fifthPlace: results.filter((r) => r.rank === 5).length,
    }

    return {
      userNumbers,
      results: results.sort((a, b) => b.round - a.round),
      summary,
    }
  }, [])

  // WASM을 사용한 번호 체크
  const checkNumbersWasm = useCallback(async (userNumbers: number[]): Promise<CheckResult | null> => {
    if (!moduleRef.current || !startSimulationRef.current) {
      return null
    }

    const mod = moduleRef.current
    
    // 6개의 int32를 위한 메모리 할당 (4바이트 * 6 = 24바이트)
    const ptr = mod._malloc(6 * 4)
    
    // HEAP32에 번호 복사 (HEAP32는 int32 배열이므로 인덱스는 ptr >> 2)
    for (let i = 0; i < 6; i++) {
      mod.HEAP32[(ptr >> 2) + i] = userNumbers[i]
    }
    
    // WASM 함수 호출
    startSimulationRef.current(ptr)
    
    // 메모리 해제
    mod._free(ptr)
    
    // WASM 실행 후 JS에서 결과 계산 (WASM은 시뮬레이션만 수행)
    return checkNumbersJS(userNumbers)
  }, [checkNumbersJS])

  const checkNumbers = useCallback(async (numbers: number[]): Promise<CheckResult | null> => {
    try {
      // WASM이 준비되면 WASM 사용, 아니면 JS 폴백
      if (status === 'ready' && moduleRef.current && startSimulationRef.current) {
        return await checkNumbersWasm(numbers)
      }
      // JS 폴백
      return await checkNumbersJS(numbers)
    } catch (err) {
      console.error('[v0] 번호 확인 중 오류:', err)
      return null
    }
  }, [status, checkNumbersWasm, checkNumbersJS])

  return { status, error, checkNumbers }
}
