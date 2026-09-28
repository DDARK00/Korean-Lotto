import type { LottoHistory } from '@lib/types'

// 히스토리 데이터 캐시 (JS 엔진 / WASM 결과 매핑 / 벤치마크가 공유)
let historyDataCache: LottoHistory[] | null = null
const LOTTO_DATA_URL = `${import.meta.env.BASE_URL}data/lotto_history.json`;

export async function loadHistoryData(): Promise<LottoHistory[]> {
  if (historyDataCache) return historyDataCache

  const response = await fetch(LOTTO_DATA_URL, {
    cache: 'no-cache'
  })
  if (!response.ok) {
    throw new Error('히스토리 데이터를 불러올 수 없습니다.')
  }
  historyDataCache = await response.json()
  return historyDataCache!
}
