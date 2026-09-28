import { LottoBall } from './LottoBall'
import { formatPrize, type LottoResult } from '@lib/types'

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
  if (rank === 1) return 'bg-gradient-to-r from-rank-1 to-rank-1-end text-rank-1-fg'
  if (rank === 2) return 'bg-gradient-to-r from-rank-2 to-rank-2-end text-rank-2-fg'
  if (rank === 3) return 'bg-gradient-to-r from-rank-3 to-rank-3-end text-rank-3-fg'
  if (rank === 4) return 'bg-rank-4 text-rank-4-fg'
  if (rank === 5) return 'bg-rank-5 text-rank-5-fg'
  return 'bg-rank-none text-rank-none-fg'
}


export function ResultCard({ result, userNumbers }: ResultCardProps) {
  const rankClass = getRankColorClass(result.rank)
  let winningPrize = 0
  switch (result.rank) {
    case 1:
      winningPrize = result.prize1st
      break;
    case 2:
      winningPrize = result.prize2nd
      break;
    case 3:
      winningPrize = result.prize3rd
      break;
    case 4:
      winningPrize = 50000
      break;
    case 5:
      winningPrize = 5000;
      break;
  }
  return (
    <article className="bg-surface border border-line-card rounded-xl shadow-md p-3 sm:p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="inline text-lg font-bold text-fg">{result.round}회</h3>
          {result.rank && result.rank <= 3 && (
            <span className="text-xs text-fg-muted ml-2">
              (1등 {formatPrize(result.prize1st)})
            </span>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-bold ${rankClass}`}>
          {getRankText(result.rank)}
        </span>
      </div>
      <div className='flex'>
        <span className='ml-auto px-3 text-fg'>
          {formatPrize(winningPrize)}
        </span>

      </div>
      {/* 당첨 번호 */}
      <div className="mb-3">
        <p className="text-xs text-fg-muted mb-2">당첨 번호</p>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {result.numbers.map((num) => (
            <LottoBall
              key={num}
              number={num}
              size="sm"
              isMatched={userNumbers.includes(num)}
            />
          ))}
          <span className="text-fg-muted mx-0.5 sm:mx-1" aria-label="보너스">+</span>
          <LottoBall
            number={result.bonusNumber}
            size="sm"
            isBonus
            isMatched={userNumbers.includes(result.bonusNumber)}
          />
        </div>
      </div>

      {/* 일치 정보 */}
      <div className="text-sm text-fg-muted">
        <span className="font-medium text-accent">{result.matchCount}개 일치</span>
        {result.hasBonusMatch && (
          <span className="ml-2 text-bonus">(보너스 일치)</span>
        )}
      </div>
    </article>
  )
}
