import { LottoBall } from './LottoBall'
import type { LottoResult } from '@lib/types'

interface ResultCardProps {
  result: LottoResult
  userNumbers: number[]
}

function getRankText(rank: number | null): string {
  if (rank === null) return '낙첨'
  if (rank === 1) return '1등'
  if (rank === 2) return '2등'
  if (rank === 3) return '3등'
  if (rank === 4) return '4등'
  if (rank === 5) return '5등'
  return '낙첨'
}

function getRankColorClass(rank: number | null): string {
  if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900'
  if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900'
  if (rank === 3) return 'bg-gradient-to-r from-orange-300 to-orange-400 text-gray-900'
  if (rank === 4) return 'bg-blue-500 text-white'
  if (rank === 5) return 'bg-green-500 text-white'
  return 'bg-gray-200 text-gray-600'
}

function formatPrize(amount: number): string {
  if (amount === 0) return '-'
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`
  }
  return `${amount.toLocaleString()}원`
}

export function ResultCard({ result, userNumbers }: ResultCardProps) {
  const rankClass = getRankColorClass(result.rank)

  return (
    <div className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-lg font-bold text-gray-800">{result.round}회</span>
          {result.rank && result.rank <= 3 && (
            <span className="text-xs text-gray-500 ml-2">
              (1등 {formatPrize(result.prize1st)})
            </span>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${rankClass}`}>
          {getRankText(result.rank)}
        </span>
      </div>

      {/* 당첨 번호 */}
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">당첨 번호</p>
        <div className="flex items-center gap-2">
          {result.numbers.map((num) => (
            <LottoBall
              key={num}
              number={num}
              size="sm"
              isMatched={userNumbers.includes(num)}
            />
          ))}
          <span className="text-gray-400 mx-1">+</span>
          <LottoBall
            number={result.bonusNumber}
            size="sm"
            isBonus
            isMatched={userNumbers.includes(result.bonusNumber)}
          />
        </div>
      </div>

      {/* 일치 정보 */}
      <div className="text-sm text-gray-600">
        <span className="font-medium text-blue-600">{result.matchCount}개 일치</span>
        {result.hasBonusMatch && (
          <span className="ml-2 text-purple-600">(보너스 일치)</span>
        )}
      </div>
    </div>
  )
}
