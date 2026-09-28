import { LottoBall } from './LottoBall'
import { formatPrize, type CheckResult } from '@lib/types'
import type { UniverseSimulationResult } from '@hooks/useWasm'

interface UniverseSummaryProps {
  result: CheckResult
  universe: UniverseSimulationResult | null
}

// 최고 조합의 각 번호가 내 번호 대비 얼마나 이동했는지 표시 (정렬 기준 인덱스끼리 비교)
// 바뀌지 않은 번호는 표시하지 않음 (높이 유지를 위해 공백만)
function getShiftText(shift: number): string {
  if (shift > 0) return `+${shift}`
  if (shift < 0) return `${shift}`
  return ' '
}

function getShiftColorClass(shift: number): string {
  if (shift > 0) return 'text-up'
  if (shift < 0) return 'text-down'
  return ''
}

// ±1 평행우주 결과를 "한 끗 차이" 카드로 노출
// 조합 수 × 회차 수 누적값(수만 회)은 사용자 체감과 어긋나서 노출하지 않고,
// 최고 조합 + 조합당 평균(내 번호와 같은 단위)만 보여줌
export function UniverseSummary({ result, universe }: UniverseSummaryProps) {
  // WASM 전용 기능: 엔진 미준비/에러 시 안내만 노출
  if (!universe) {
    return (
      <section
        aria-labelledby="universe-title"
        className="bg-surface border border-line-card rounded-2xl shadow-lg p-4 sm:p-6 mb-6"
      >
        <h2 id="universe-title" className="text-xl font-bold text-fg mb-2">한 끗 차이</h2>
        <p className="text-sm text-fg-muted">
          WASM 엔진 전용 기능입니다. 엔진이 준비되지 않아 이번 결과에서는 계산하지 못했습니다.
        </p>
      </section>
    )
  }

  const { summary } = result

  const universeWins =
    universe.rank1Count + universe.rank2Count + universe.rank3Count + universe.rank4Count + universe.rank5Count
  const myWins =
    summary.firstPlace + summary.secondPlace + summary.thirdPlace + summary.fourthPlace + summary.fifthPlace
  // 조합 1개당 평균 당첨 횟수 (내 번호와 같은 기준으로 비교하기 위함), 표시값 기준으로 비교
  const avgWins = universe.totalCombinations > 0
    ? Math.round((universeWins / universe.totalCombinations) * 10) / 10
    : 0
  const verdict = myWins > avgWins ? '평균보다 많음' : myWins < avgWins ? '평균보다 적음' : '평균과 같음'

  const sortedUserNumbers = [...result.userNumbers].sort((a, b) => a - b)
  const hasBest = universe.maxPrize > 0n && universe.bestCombination.length === 6
  const shifts = hasBest ? universe.bestCombination.map((num, idx) => num - sortedUserNumbers[idx]) : []
  const shiftedCount = shifts.filter((shift) => shift !== 0).length
  const isBestMine = hasBest && shiftedCount === 0

  return (
    <section
      aria-labelledby="universe-title"
      className="bg-surface border border-line-card rounded-2xl shadow-lg p-4 sm:p-6 mb-6"
    >
      <div className="mb-4">
        <h2 id="universe-title" className="text-xl font-bold text-fg">한 끗 차이</h2>
        <p className="text-sm text-fg-muted mt-1">번호를 하나씩만 옆으로 옮겼다면?</p>
      </div>

      {/* 헤드라인: 최고 당첨금 조합 */}
      {hasBest ? (
        <div className="p-4 sm:p-5 bg-surface-muted rounded-xl mb-4">
          <p className="text-fg-soft font-medium">
            {isBestMine ? '옆 번호 중 내 번호가 최고였습니다' : `번호 ${shiftedCount}개만 옮겼다면`}
          </p>
          <p className="text-3xl sm:text-4xl font-bold text-accent mt-1">
            {formatPrize(Number(universe.maxPrize))}
          </p>
          <p className="text-sm text-fg-muted mt-1 mb-4">{universe.bestEpisode}회 당첨금</p>

          <div className="flex items-start gap-2 sm:gap-3">
            {universe.bestCombination.map((num, idx) => (
              <div key={num} className="flex flex-col items-center gap-1">
                <LottoBall number={num} size="lg" />
                {!isBestMine && (
                  <span className={`text-xs font-bold ${getShiftColorClass(shifts[idx])}`}>
                    {getShiftText(shifts[idx])}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-fg-muted bg-surface-muted rounded-xl mb-4">
          옆 번호들도 당첨은 없었습니다.
        </div>
      )}

      {/* 한 줄 비교: 내 번호 vs 옆 번호 평균 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fg-soft">
          내 번호 <strong className="text-fg">{myWins}회</strong> 당첨
          <span className="text-fg-muted mx-2" aria-hidden="true">·</span>
          옆 번호 평균 <strong className="text-fg">{avgWins.toFixed(1)}회</strong>
        </p>
        <span className="px-3 py-1 rounded-full text-sm font-bold bg-accent text-accent-fg">
          {verdict}
        </span>
      </div>
      <p className="text-xs text-fg-muted mt-2">
        옆 번호 조합 {universe.totalCombinations.toLocaleString()}개 기준
      </p>
    </section>
  )
}
