import { useState, useCallback } from 'react'
import { useWasm } from '@hooks/useWasm'
import { NumberInput, ResultSummary, ResultCard, LottoBall } from '@components/common/lotto'
import type { CheckResult } from '@lib/types'

type FilterType = 'all' | 'winners' | '1' | '2' | '3' | '4' | '5'

export default function CheckerPage() {
  const { status, error: wasmError, checkNumbers } = useWasm()
  const [result, setResult] = useState<CheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [filter, setFilter] = useState<FilterType>('winners')

  const handleCheck = useCallback(async (numbers: number[]) => {
    setIsChecking(true)
    setResult(null)

    try {
      const checkResult = await checkNumbers(numbers)
      if (checkResult) {
        setResult(checkResult)
      }
    } catch (err) {
      console.error('[v0] 당첨 확인 오류:', err)
    } finally {
      setIsChecking(false)
    }
  }, [checkNumbers])

  const filteredResults = result?.results.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'winners') return r.rank !== null
    return r.rank === parseInt(filter)
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            로또 당첨 확인기
          </h1>
          <p className="text-gray-600">
            나의 번호가 역대 모든 로또에서 당첨되었는지 확인해보세요!
          </p>
        </header>

        {/* WASM 로딩 상태 */}
        {status === 'loading' && (
          <div className="text-center py-4 mb-4">
            <div className="inline-block w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-gray-500 text-sm">엔진 로딩 중...</p>
          </div>
        )}

        {/* WASM 에러 (폴백 모드 알림) */}
        {wasmError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-6 text-center">
            <p className="text-yellow-700 text-sm">
              WASM 엔진을 로드할 수 없습니다. 기본 모드로 동작합니다.
            </p>
          </div>
        )}

        {/* 번호 입력 */}
        <NumberInput onSubmit={handleCheck} isLoading={isChecking} />

        {/* 결과 영역 */}
        {result && (
          <div className="mt-8">
            {/* 내 번호 표시 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">내 번호</h2>
              <div className="flex items-center gap-3">
                {result.userNumbers.map((num) => (
                  <LottoBall key={num} number={num} size="lg" />
                ))}
              </div>
            </div>

            {/* 결과 요약 */}
            <ResultSummary result={result} />

            {/* 필터 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { value: 'winners', label: '당첨만' },
                { value: 'all', label: '전체' },
                { value: '1', label: '1등' },
                { value: '2', label: '2등' },
                { value: '3', label: '3등' },
                { value: '4', label: '4등' },
                { value: '5', label: '5등' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as FilterType)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
                    ${filter === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 결과 리스트 */}
            <div className="space-y-3">
              {filteredResults && filteredResults.length > 0 ? (
                filteredResults.map((r) => (
                  <ResultCard key={r.round} result={r} userNumbers={result.userNumbers} />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  해당 조건의 결과가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 푸터 */}
        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>데이터는 동행복권 공식 결과를 기반으로 합니다.</p>
        </footer>
      </div>
    </div>
  )
}
