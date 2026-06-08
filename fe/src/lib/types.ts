// 실제 lotto_history.json 데이터 형식
export interface LottoHistory {
  ltEpsd: number         // 회차
  tm1WnNo: number        // 당첨번호 1
  tm2WnNo: number        // 당첨번호 2
  tm3WnNo: number        // 당첨번호 3
  tm4WnNo: number        // 당첨번호 4
  tm5WnNo: number        // 당첨번호 5
  tm6WnNo: number        // 당첨번호 6
  bnsWnNo: number        // 보너스 번호
  rnk1WnNope: number     // 1등 당첨자 수
  rnk1WnAmt: number      // 1등 당첨금
  rnk2WnNope: number     // 2등 당첨자 수
  rnk2WnAmt: number      // 2등 당첨금
  rnk3WnNope: number     // 3등 당첨자 수
  rnk3WnAmt: number      // 3등 당첨금
}

// 당첨 결과
export interface LottoResult {
  round: number
  numbers: number[]
  bonusNumber: number
  matchCount: number
  matchedNumbers: number[]
  hasBonusMatch: boolean
  rank: number | null
  prize1st: number
  prize2nd: number
  prize3rd: number
}

export interface PrizeSummary {
  first: number;
  second: number;
  third: number;
  fourth: number;
  fifth: number;
  total: number; // 총 당첨금
}

// 결과 요약
export interface ResultSummary {
  total: number
  firstPlace: number
  secondPlace: number
  thirdPlace: number
  fourthPlace: number
  fifthPlace: number
  prizes: PrizeSummary
}

// 전체 결과
export interface CheckResult {
  userNumbers: number[]
  results: LottoResult[]
  summary: ResultSummary
}

// LottoHistory에서 당첨번호 배열로 변환
export function getWinningNumbers(history: LottoHistory): number[] {
  return [
    history.tm1WnNo,
    history.tm2WnNo,
    history.tm3WnNo,
    history.tm4WnNo,
    history.tm5WnNo,
    history.tm6WnNo,
  ]
}

// 등수 계산
export function calculateRank(matchCount: number, hasBonus: boolean): number | null {
  if (matchCount === 6) return 1
  if (matchCount === 5 && hasBonus) return 2
  if (matchCount === 5) return 3
  if (matchCount === 4) return 4
  if (matchCount === 3) return 5
  return null
}

// 금액 포맷
export function formatPrize(amount: number): string {
  if (amount === 0) return '-'
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`
  }
  return `${amount.toLocaleString()}원`
}
