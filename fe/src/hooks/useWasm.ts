import { useState, useEffect, useCallback, useRef } from 'react'
import type { CheckResult, UniverseSimulationResult } from '@lib/types'
import { computeJS } from '@lib/engine/js'
import { computeWASM, computeUniverseWASM } from '@lib/engine/wasm'
import wasmUrl from '../wasm/engine.wasm?url';
import createModule, { WasmEngineModule } from '../wasm/engine.js';

type WasmStatus = 'loading' | 'ready' | 'error'

interface UseWasmReturn {
  status: WasmStatus
  error: string | null
  checkNumbers: (numbers: number[]) => Promise<CheckResult | null>
  runUniverseSimulation: (numbers: number[]) => Promise<UniverseSimulationResult | null>
  _rawWasmContext: {
    mod: WasmEngineModule | null
    wasmFn: ((userBitset: bigint, outPtr: number) => number) | null
    runPm1Fn: ((inPtr: number, outPtr: number) => number) | null
  }
}

/* =========================
 * MAIN CUSTOM HOOK
 * ========================= */
export function useWasm(): UseWasmReturn {
  const [status, setStatus] = useState<WasmStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const moduleRef = useRef<WasmEngineModule | null>(null)
  const startSimulationRef = useRef<((userBitset: bigint, outPtr: number) => number) | null>(null)
  const runPm1SimulationRef = useRef<((inPtr: number, outPtr: number) => number) | null>(null)
  const statusRef = useRef<WasmStatus>('loading')

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    let isMounted = true
    let timer: ReturnType<typeof setTimeout>

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
        runPm1SimulationRef.current = mod.cwrap(
          'run_pm1_simulation',
          'number',
          ['number', 'number']
        )

        setStatus('ready')
      } catch (err: any) {
        console.error('WASM 모듈 로드 실패, JS 모드로 자동 대체됩니다:', err)
        if (isMounted) {
          clearTimeout(timer)
          setError(err?.message || 'WASM 모듈 로드 실패')
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

  /* ±1 평행우주 대조 (WASM 전용: 로딩 미완료/에러 시 null 반환) */
  const runUniverseSimulation = useCallback(
    async (numbers: number[]): Promise<UniverseSimulationResult | null> => {
      const mod = moduleRef.current
      const runPm1Fn = runPm1SimulationRef.current

      if (statusRef.current === 'ready' && mod && runPm1Fn) {
        return await computeUniverseWASM(mod, runPm1Fn, numbers)
      }

      console.warn('⚡ [WASM 전용] WASM 엔진이 준비되지 않아 평행우주 연산을 건너뜁니다.')
      return null
    },
    []
  )

  return {
    status,
    error,
    checkNumbers,
    runUniverseSimulation,
    _rawWasmContext: {
      mod: moduleRef.current,
      wasmFn: startSimulationRef.current,
      runPm1Fn: runPm1SimulationRef.current,
    }
  }
}
