import type { LottoResult, CheckResult, ResultSummary, PrizeSummary } from '@lib/types'
import { getWinningNumbers, calculateRank } from '@lib/types'
import { loadHistoryData } from '@lib/history'

/* =========================
 * JS ENGINE (fallback)
 * ========================= */
export async function computeJS(userNumbers: number[]): Promise<CheckResult> {
  const history = await loadHistoryData()

  const prizes: PrizeSummary = {
    first: 0,
    second: 0,
    third: 0,
    fourth: 0,
    fifth: 0,
    total: 0
  }

  const RANK_KEYS: (keyof Omit<PrizeSummary, 'total'>)[] = [
    'first',  // 1등
    'second', // 2등
    'third',  // 3등
    'fourth', // 4등
    'fifth'   // 5등
  ];

  const results: LottoResult[] = []
  for (let i = 0; i < history.length; i++) {
    let draw = history[i]

    const winningNumbers = getWinningNumbers(draw)

    const matchedNumbers = userNumbers.filter(n =>
      winningNumbers.includes(n)
    )

    const matchCount = matchedNumbers.length
    const hasBonusMatch = userNumbers.includes(draw.bnsWnNo)
    const rank = calculateRank(matchCount, hasBonusMatch)
    if (!rank) continue;

    const amount =
      rank === 1 ? draw.rnk1WnAmt :
        rank === 2 ? draw.rnk2WnAmt :
          rank === 3 ? draw.rnk3WnAmt :
            rank === 4 ? 50000 : 5000;
    const targetKey = RANK_KEYS[rank - 1];

    prizes[targetKey] += amount;
    prizes.total += amount;
    results.push({
      round: draw.ltEpsd,
      numbers: winningNumbers,
      bonusNumber: draw.bnsWnNo,
      matchCount,
      matchedNumbers,
      hasBonusMatch,
      rank,
      prize1st: draw.rnk1WnAmt,
      prize2nd: draw.rnk2WnAmt,
      prize3rd: draw.rnk3WnAmt,
    })
  }

  const summary: ResultSummary = {
    total: history.length,
    firstPlace: results.filter(r => r.rank === 1).length,
    secondPlace: results.filter(r => r.rank === 2).length,
    thirdPlace: results.filter(r => r.rank === 3).length,
    fourthPlace: results.filter(r => r.rank === 4).length,
    fifthPlace: results.filter(r => r.rank === 5).length,
    prizes
  }

  return {
    userNumbers,
    results: results.sort((a, b) => b.round - a.round),
    summary,
  }
}
