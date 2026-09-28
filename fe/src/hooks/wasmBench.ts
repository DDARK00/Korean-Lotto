import type { LottoHistory, UniverseSimulationResult } from '@lib/types'
import { getWinningNumbers } from '@lib/types'
import { loadHistoryData } from '@lib/history'

/* =========================================================
 * JS ENGINE (PM1 Universe Simulation) - 벤치마크/교차 검증용
 * WASM과 같은 알고리즘(비트마스크 + popcount), 같은 순회 순서로 구현
 * (순서가 같아야 최고 당첨금 동점 시 best_bitset / best_episode 까지 일치)
 * ========================================================= */

// 회차별 당첨번호를 32비트 두 조각(1~32 → lo, 33~45 → hi)으로 미리 패킹 (BigInt 연산 회피)
interface PackedHistory {
  length: number
  lo: Int32Array
  hi: Int32Array
  bonus: Uint8Array
  episode: Uint32Array
  amt1: Float64Array
  amt2: Float64Array
  amt3: Float64Array
}

let packedHistoryCache: PackedHistory | null = null

function packHistory(history: LottoHistory[]): PackedHistory {
  const length = history.length
  const packed: PackedHistory = {
    length,
    lo: new Int32Array(length),
    hi: new Int32Array(length),
    bonus: new Uint8Array(length),
    episode: new Uint32Array(length),
    amt1: new Float64Array(length),
    amt2: new Float64Array(length),
    amt3: new Float64Array(length),
  }
  for (let i = 0; i < length; i++) {
    const draw = history[i]
    for (const num of getWinningNumbers(draw)) {
      if (num <= 32) packed.lo[i] |= 1 << (num - 1)
      else packed.hi[i] |= 1 << (num - 33)
    }
    packed.bonus[i] = draw.bnsWnNo
    packed.episode[i] = draw.ltEpsd
    packed.amt1[i] = draw.rnk1WnAmt
    packed.amt2[i] = draw.rnk2WnAmt
    packed.amt3[i] = draw.rnk3WnAmt
  }
  return packed
}

// __builtin_popcount 대응 (SWAR 방식)
function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export async function computeUniverseJS(userNumbers: number[]): Promise<UniverseSimulationResult> {
  const history = await loadHistoryData()
  if (!packedHistoryCache) packedHistoryCache = packHistory(history)
  const packed = packedHistoryCache

  // 1. 입력 번호 6개 오름차순 정렬 보장 (WASM 경로와 동일)
  const sortedNumbers = [...userNumbers].sort((a, b) => a - b)

  // 2. ±1 조합 생성: 첫 번째 번호가 가장 바깥 루프, 오프셋 -1 → 0 → +1 순서
  //    범위(1~45) 밖이거나 번호가 겹치는 조합, 이미 나온 조합은 제외
  const OFFSETS = [-1, 0, 1]
  const combLo: number[] = []
  const combHi: number[] = []
  const seen = new Set<number>()
  const digits = [0, 0, 0, 0, 0, 0]

  for (let m = 0; m < 729; m++) {
    // 3진수 자릿수 추출 (6번째 번호가 가장 빠르게 바뀜)
    let t = m
    for (let k = 5; k >= 0; k--) {
      digits[k] = t % 3
      t = (t / 3) | 0
    }

    let lo = 0
    let hi = 0
    let valid = true
    for (let k = 0; k < 6; k++) {
      const num = sortedNumbers[k] + OFFSETS[digits[k]]
      if (num < 1 || num > 45) { valid = false; break }
      if (num <= 32) {
        const bit = 1 << (num - 1)
        if (lo & bit) { valid = false; break }
        lo |= bit
      } else {
        const bit = 1 << (num - 33)
        if (hi & bit) { valid = false; break }
        hi |= bit
      }
    }
    if (!valid) continue

    // 45비트 키 → Number 안전 범위(2^53) 이내
    const key = hi * 4294967296 + (lo >>> 0)
    if (seen.has(key)) continue
    seen.add(key)
    combLo.push(lo)
    combHi.push(hi)
  }

  const combCount = combLo.length
  const cLo = Int32Array.from(combLo)
  const cHi = Int32Array.from(combHi)

  // 3. 회차(바깥) × 조합(안쪽) 전수 대조 - C++ run_parallel_simulation 과 같은 루프 구조
  let rank1Count = 0, rank2Count = 0, rank3Count = 0, rank4Count = 0, rank5Count = 0
  let maxPrize = 0
  let bestLo = 0
  let bestHi = 0
  let bestEpisode = 0

  for (let i = 0; i < packed.length; i++) {
    const wLo = packed.lo[i]
    const wHi = packed.hi[i]
    const bonus = packed.bonus[i]
    const bonusInLo = bonus <= 32
    const bonusBit = bonusInLo ? 1 << (bonus - 1) : 1 << (bonus - 33)

    for (let j = 0; j < combCount; j++) {
      const matchCount = popcount32(cLo[j] & wLo) + popcount32(cHi[j] & wHi)
      if (matchCount < 3) continue

      let prize: number
      if (matchCount === 6) {
        rank1Count++
        prize = packed.amt1[i]
      } else if (matchCount === 5) {
        const hasBonus = ((bonusInLo ? cLo[j] : cHi[j]) & bonusBit) !== 0
        if (hasBonus) {
          rank2Count++
          prize = packed.amt2[i]
        } else {
          rank3Count++
          prize = packed.amt3[i]
        }
      } else if (matchCount === 4) {
        rank4Count++
        prize = 50000
      } else {
        rank5Count++
        prize = 5000
      }

      // 최대 당첨금 및 최고 적중 정보 갱신 (C++ 과 동일하게 '초과'일 때만 → 먼저 나온 쪽 우선)
      if (prize > maxPrize) {
        maxPrize = prize
        bestLo = cLo[j]
        bestHi = cHi[j]
        bestEpisode = packed.episode[i]
      }
    }
  }

  // 4. WASM 결과 구조와 동일한 형태로 반환
  const bestCombination: number[] = []
  for (let n = 1; n <= 45; n++) {
    const hit = n <= 32 ? (bestLo >>> (n - 1)) & 1 : (bestHi >>> (n - 33)) & 1
    if (hit) bestCombination.push(n)
  }

  return {
    totalCombinations: combCount,
    rank1Count,
    rank2Count,
    rank3Count,
    rank4Count,
    rank5Count,
    maxPrize: BigInt(maxPrize),
    bestBitset: (BigInt(bestHi >>> 0) << 32n) | BigInt(bestLo >>> 0),
    bestEpisode,
    bestCombination,
  }
}
