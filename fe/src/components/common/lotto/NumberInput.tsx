import { useState, useCallback } from 'react'
import { LottoBall } from './LottoBall'

interface NumberInputProps {
  onSubmit: (numbers: number[]) => void
  isLoading?: boolean
  selectedNumbers: number[]
  setSelectedNumbers: React.Dispatch<React.SetStateAction<number[]>>
}

export function NumberInput({ onSubmit, isLoading = false, selectedNumbers, setSelectedNumbers }: NumberInputProps) {
  const [error, setError] = useState<string | null>(null)

  const handleNumberClick = useCallback((num: number) => {
    setError(null)
    setSelectedNumbers((prev) => {
      if (prev.includes(num)) {
        return prev.filter((n) => n !== num)
      }
      if (prev.length >= 6) {
        setError('6개의 번호만 선택할 수 있습니다.')
        return prev
      }
      return [...prev, num].sort((a, b) => a - b)
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (selectedNumbers.length !== 6) {
      setError('6개의 번호를 선택해주세요.')
      return
    }
    onSubmit(selectedNumbers)
  }, [selectedNumbers, onSubmit])

  const handleClear = useCallback(() => {
    setSelectedNumbers([])
    setError(null)
  }, [])

  const handleRandom = useCallback(() => {
    const numbers: number[] = []
    while (numbers.length < 6) {
      const rand = Math.floor(Math.random() * 45) + 1
      if (!numbers.includes(rand)) {
        numbers.push(rand)
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b))
    setError(null)
  }, [])

  return (
    <section
      aria-labelledby="number-input-title"
      className="bg-surface border border-line-card rounded-2xl shadow-lg p-4 sm:p-6 max-w-2xl mx-auto"
    >
      {/* 선택된 번호 표시 영역 */}
      <div className="mb-6">
        <h2 id="number-input-title" className="text-lg font-semibold text-fg-soft mb-3">선택한 번호</h2>
        <div
          aria-live="polite"
          className="flex items-center gap-2 sm:gap-3 min-h-14 p-3 sm:p-4 bg-surface-muted rounded-xl"
        >
          {selectedNumbers.length > 0 ? (
            selectedNumbers.map((num) => (
              <LottoBall key={num} number={num} size="lg" />
            ))
          ) : (
            <span className="text-fg-muted">아래에서 6개의 번호를 선택하세요</span>
          )}
        </div>
        {error && <p role="alert" className="text-danger text-sm mt-2">{error}</p>}
      </div>

      {/* 번호 선택 그리드 (칸 폭에 맞춰 버튼 크기가 늘고 줄어듦) */}
      <div className="mb-6">
        <div role="group" aria-label="번호 선택 (1~45)" className="grid grid-cols-9 gap-1.5 sm:gap-2">
          {Array.from({ length: 45 }, (_, i) => i + 1).map((num) => {
            const isSelected = selectedNumbers.includes(num)
            return (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num)}
                disabled={isLoading}
                aria-pressed={isSelected}
                className={`
                  w-full max-w-10 aspect-square mx-auto rounded-full font-semibold text-xs sm:text-sm
                  border transition-all duration-150
                  ${isSelected
                    ? 'bg-accent text-accent-fg border-accent scale-110 shadow-md'
                    : 'bg-control text-fg-soft border-line-control hover:bg-control-hover'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {num}
              </button>
            )
          })}
        </div>
      </div>

      {/* 버튼 영역 */}
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handleRandom}
          disabled={isLoading}
          className="flex-1 py-3 px-2 sm:px-4 bg-control text-fg-soft font-semibold rounded-xl border border-line-control
                     hover:bg-control-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          자동 선택
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isLoading}
          className="flex-1 py-3 px-2 sm:px-4 bg-control text-fg-soft font-semibold rounded-xl border border-line-control
                     hover:bg-control-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          초기화
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || selectedNumbers.length !== 6}
          className="flex-1 py-3 px-2 sm:px-4 bg-accent text-accent-fg font-semibold rounded-xl
                     hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '확인 중...' : '당첨 확인'}
        </button>
      </div>
    </section>
  )
}
