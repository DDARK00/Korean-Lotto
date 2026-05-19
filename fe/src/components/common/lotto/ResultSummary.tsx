import type { CheckResult } from '@lib/types'

interface ResultSummaryProps {
  result: CheckResult
}

export function ResultSummary({ result }: ResultSummaryProps) {
  const { summary } = result

  const stats = [
    { label: '1등', count: summary.firstPlace, color: 'bg-yellow-400 text-gray-900' },
    { label: '2등', count: summary.secondPlace, color: 'bg-gray-300 text-gray-900' },
    { label: '3등', count: summary.thirdPlace, color: 'bg-orange-300 text-gray-900' },
    { label: '4등', count: summary.fourthPlace, color: 'bg-blue-500 text-white' },
    { label: '5등', count: summary.fifthPlace, color: 'bg-green-500 text-white' },
  ]

  const totalWins = summary.firstPlace + summary.secondPlace + summary.thirdPlace + summary.fourthPlace + summary.fifthPlace

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">결과 요약</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {stats.map(({ label, count, color }) => (
          <div key={label} className="text-center">
            <div className={`${color} rounded-xl py-3 px-4 font-bold text-lg mb-1`}>
              {count}회
            </div>
            <span className="text-sm text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
        <span className="text-gray-600">총 {summary.total}회차 중</span>
        <span className="text-lg font-bold text-blue-600">
          {totalWins}회 당첨 ({((totalWins / summary.total) * 100).toFixed(2)}%)
        </span>
      </div>
    </div>
  )
}
