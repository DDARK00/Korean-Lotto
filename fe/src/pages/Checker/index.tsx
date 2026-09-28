import { useState, useCallback, useRef, useEffect } from 'react'
import { useWasm, type UniverseSimulationResult } from '@hooks/useWasm'
import { NumberInput, ResultSummary, ResultCard, LottoBall, UniverseSummary } from '@components/common/lotto'
import type { CheckResult } from '@lib/types'
import WasmTester from '@/hooks/WasmTester'
import { ThemeToggle } from '@components/common/ThemeToggle'

// 결과 리스트에는 당첨 회차만 담기므로 'all'이 곧 당첨 전체
type FilterType = 'all' | '1' | '2' | '3' | '4' | '5'

export default function CheckerPage() {
  const { status, error: wasmError, checkNumbers, runUniverseSimulation } = useWasm()
  const [result, setResult] = useState<CheckResult | null>(null)
  const [universe, setUniverse] = useState<UniverseSimulationResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const resultRef = useRef<HTMLDivElement>(null)

  const handleCheck = useCallback(async (numbers: number[]) => {
    setIsChecking(true)

    try {
      const checkResult = await checkNumbers(numbers)
      if (checkResult) {
        // ±1 평행우주는 WASM 전용이라 실패해도 기본 결과는 그대로 노출
        let universeResult: UniverseSimulationResult | null = null
        try {
          universeResult = await runUniverseSimulation(numbers)
        } catch (err) {
          console.error('평행우주 연산 오류:', err)
        }
        setUniverse(universeResult)
        setResult(checkResult)
      }
    } catch (err) {
      console.error('당첨 확인 오류:', err)
      alert('알 수 없는 오류가 발생했습니다! 당첨 확인 오류!')
      setResult(null)
      setUniverse(null)
    } finally {
      setIsChecking(false)
    }
  }, [checkNumbers, runUniverseSimulation])

  // 새 결과가 나오면 결과 영역으로 스크롤 (입력 카드가 길어서 결과가 화면 밖에 생기는 문제)
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const filteredResults = result?.results.filter((r) => {
    if (filter === 'all') return true
    return r.rank === parseInt(filter)
  })

  // 필터 버튼에 표시할 건수
  const filterCounts: Record<FilterType, number> = {
    all: result?.results.length ?? 0,
    '1': result?.summary.firstPlace ?? 0,
    '2': result?.summary.secondPlace ?? 0,
    '3': result?.summary.thirdPlace ?? 0,
    '4': result?.summary.fourthPlace ?? 0,
    '5': result?.summary.fifthPlace ?? 0,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page-from to-page-to text-fg break-keep py-6 sm:py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <header className="text-center mb-6 sm:mb-8">
          <div className="flex justify-end mb-2">
            <ThemeToggle />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-fg mb-2">
            로또 당첨 확인기
          </h1>
          <p className="text-fg">
            만약 이 번호를 계속 샀다면?
          </p>
          <p className="text-fg ">
            내가 고른 번호, 역대 로또 당첨 데이터와 비교해 보기
          </p>
        </header>

        <main>
          {/* WASM 로딩 상태 */}
          {status === 'loading' && (
            <div role="status" className="text-center py-4 mb-4">
              <div className="inline-block w-6 h-6 border-[3px] border-accent border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-fg-muted text-sm">엔진 로딩 중...</p>
            </div>
          )}

          {/* WASM 에러 (폴백 모드 알림) */}
          {wasmError && (
            <div role="alert" className="bg-warn-bg border border-warn-line rounded-xl p-3 mb-6 text-center">
              <p className="text-warn-fg text-sm">
                WASM 엔진을 로드할 수 없습니다. 기본 모드로 동작합니다.
                <br />
                {wasmError}
              </p>
            </div>
          )}

          {/* 번호 입력 */}
          <NumberInput  selectedNumbers={selectedNumbers} setSelectedNumbers={setSelectedNumbers} onSubmit={handleCheck} isLoading={isChecking} />

          {/* 결과 영역 */}
          {result && (
            <div ref={resultRef} className="mt-8 scroll-mt-4">
              {/* 내 번호 표시 */}
              <section
                aria-labelledby="my-numbers-title"
                className="bg-surface border border-line-card rounded-2xl shadow-lg p-4 sm:p-6 mb-6"
              >
                <h2 id="my-numbers-title" className="text-lg font-semibold text-fg-soft mb-3">내 번호</h2>
                <div className="flex items-center gap-2 sm:gap-3">
                  {result.userNumbers.map((num) => (
                    <LottoBall key={num} number={num} size="lg" />
                  ))}
                </div>
              </section>

              {/* 결과 요약 */}
              <ResultSummary result={result} />

              {/* ±1 평행우주 결과 (한 끗 차이) */}
              <UniverseSummary result={result} universe={universe} />

              <section aria-labelledby="result-list-title">
                <h2 id="result-list-title" className="sr-only">회차별 당첨 내역</h2>

                {/* 필터 */}
                <div role="group" aria-label="등수 필터" className="flex flex-wrap gap-2 mb-4">
                  {[
                    { value: 'all', label: '전체' },
                    { value: '1', label: '1등' },
                    { value: '2', label: '2등' },
                    { value: '3', label: '3등' },
                    { value: '4', label: '4등' },
                    { value: '5', label: '5등' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value as FilterType)}
                      aria-pressed={filter === value}
                      className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium border transition-colors
                        ${filter === value
                          ? 'bg-accent text-accent-fg border-accent'
                          : 'bg-surface text-fg-muted border-line-control hover:bg-control-hover'
                        }`}
                    >
                      {label}
                      <span className="ml-1 opacity-70">{filterCounts[value as FilterType]}</span>
                    </button>
                  ))}
                </div>

                {/* 결과 리스트 */}
                {filteredResults && filteredResults.length > 0 ? (
                  <ul className="space-y-3">
                    {filteredResults.map((r) => (
                      <li key={r.round}>
                        <ResultCard result={r} userNumbers={result.userNumbers} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8 text-fg-muted">
                    해당 조건의 결과가 없습니다.
                  </div>
                )}
              </section>
            </div>
          )}
        </main>

        {/* 푸터 */}
        <footer className="text-center mt-12 text-fg-muted text-sm">
          <p>데이터는 동행복권 공식 결과를 기반으로 합니다.</p>
        </footer>
      </div>
      {/* 엔진 검증 도구: 개발자 도구(F12) 콘솔 전제라 데스크톱에서만 노출 */}
      <aside aria-label="엔진 검증 도구" className="hidden md:block">
        <WasmTester selectedNumbers={selectedNumbers} />
      </aside>
    </div>
  )
}
