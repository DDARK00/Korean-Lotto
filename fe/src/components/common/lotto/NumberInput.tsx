import { useState, useCallback } from 'react'
import { LottoBall } from './LottoBall'

interface NumberInputProps {
  onSubmit: (numbers: number[]) => void
  isLoading?: boolean
}

export function NumberInput({ onSubmit, isLoading = false }: NumberInputProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
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
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-2xl mx-auto">
      {/* 선택된 번호 표시 영역 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">선택한 번호</h2>
        <div className="flex items-center gap-3 min-h-14 p-4 bg-gray-50 rounded-xl">
          {selectedNumbers.length > 0 ? (
            selectedNumbers.map((num) => (
              <LottoBall key={num} number={num} size="lg" />
            ))
          ) : (
            <span className="text-gray-400">아래에서 6개의 번호를 선택하세요</span>
          )}
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* 번호 선택 그리드 */}
      <div className="mb-6">
        <div className="grid grid-cols-9 gap-2">
          {Array.from({ length: 45 }, (_, i) => i + 1).map((num) => {
            const isSelected = selectedNumbers.includes(num)
            return (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                disabled={isLoading}
                className={`
                  w-10 h-10 rounded-full font-semibold text-sm
                  transition-all duration-150
                  ${isSelected
                    ? 'bg-blue-600 text-white scale-110 shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
      <div className="flex gap-3">
        <button
          onClick={handleRandom}
          disabled={isLoading}
          className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 font-semibold rounded-xl
                     hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          자동 선택
        </button>
        <button
          onClick={handleClear}
          disabled={isLoading}
          className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 font-semibold rounded-xl
                     hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          초기화
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading || selectedNumbers.length !== 6}
          className="flex-1 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl
                     hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '확인 중...' : '당첨 확인'}
        </button>
      </div>
    </div>
  )
}
