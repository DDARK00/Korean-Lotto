import { formatPrize, type CheckResult } from '@lib/types'

interface ResultSummaryProps {
  result: CheckResult
}

export function ResultSummary({ result }: ResultSummaryProps) {
  const { summary } = result

  const stats = [
    { label: '1등', count: summary.firstPlace, color: 'bg-rank-1 text-rank-1-fg' },
    { label: '2등', count: summary.secondPlace, color: 'bg-rank-2 text-rank-2-fg' },
    { label: '3등', count: summary.thirdPlace, color: 'bg-rank-3 text-rank-3-fg' },
    { label: '4등', count: summary.fourthPlace, color: 'bg-rank-4 text-rank-4-fg' },
    { label: '5등', count: summary.fifthPlace, color: 'bg-rank-5 text-rank-5-fg' },
  ]

  const totalWins = summary.firstPlace + summary.secondPlace + summary.thirdPlace + summary.fourthPlace + summary.fifthPlace

  return (
    <section
      aria-labelledby="result-summary-title"
      className="bg-surface border border-line-card rounded-2xl shadow-lg p-4 sm:p-6 mb-6"
    >
      <h2 id="result-summary-title" className="text-xl font-bold text-fg mb-4">결과 요약</h2>

      {/* 모바일에서도 5칸 한 줄 유지 (2열로 접으면 5번째 칸만 홀로 남음) */}
      <div className="grid grid-cols-5 gap-2 sm:gap-4 mb-6">
        {stats.map(({ label, count, color }) => (
          <div key={label} className="text-center">
            <div className={`${color} rounded-xl py-2 sm:py-3 px-1 sm:px-4 font-bold text-base sm:text-lg mb-1`}>
              {count}회
            </div>
            <span className="text-sm text-fg-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col p-4 bg-surface-muted rounded-xl">
        <div className='flex flex-wrap justify-between gap-x-4'>
        <span className="text-fg-muted">총 {summary.total}회차 중</span>
        <span className="text-lg font-bold text-accent">
          {totalWins}회 당첨 ({((totalWins / summary.total) * 100).toFixed(2)}%)
        </span>
        </div>
        <span className='ml-auto pr-2 text-fg-muted'>합계 {formatPrize(summary.prizes.total)}</span>
      </div>
    </section>
  )
}
