import type { LottoResult, CheckResult, ResultSummary, PrizeSummary, UniverseSimulationResult } from '@lib/types'
import { getWinningNumbers } from '@lib/types'
import { loadHistoryData } from '@lib/history'
import type { WasmEngineModule } from '../../wasm/engine.js'

/*
c++ 구조체 타입
#pragma pack(push, 1)
struct LottoRecord {
    uint64_t bitset;
    uint64_t winAmt1;
    uint64_t winAmt2;
    uint64_t winAmt3;
};

// JS로 넘겨줄 필터링된 결과 구조체 (8바이트)
struct MatchResult {
    uint32_t episode;    // 회차
    uint8_t match_count; // 맞은 개수
    uint8_t has_bonus;   // 보너스 여부 (1 or 0)
    uint16_t rank;       // 등수 (1~5)
};

//  ±1 평행우주 시뮬레이션 집계 결과 (총 44바이트)
struct UniverseResult {
    uint32_t total_combinations; // offset 0  (4바이트) - 검증된 전체 조합 수 (최대 729)
    uint32_t rank1_count;        // offset 4  (4바이트) - 1등 적중 횟수
    uint32_t rank2_count;        // offset 8  (4바이트) - 2등 적중 횟수
    uint32_t rank3_count;        // offset 12 (4바이트) - 3등 적중 횟수
    uint32_t rank4_count;        // offset 16 (4바이트) - 4등 적중 횟수
    uint32_t rank5_count;        // offset 20 (4바이트) - 5등 적중 횟수
    uint64_t max_prize;          // offset 24 (8바이트) - 시뮬레이션 내 최고 단일 당첨금 (원)
    uint64_t best_bitset;        // offset 32 (8바이트) - 최고 당첨금을 기록한 64비트 비트셋
    uint32_t best_episode;       // offset 40 (4바이트) - 최고 당첨금이 나온 회차
};

#pragma pack(pop)

*/

/* =========================
 * WASM ENGINE (Single-Bitset Simulation)
 * ========================= */
export async function computeWASM(
  mod: WasmEngineModule,
  startFn: (userBitset: bigint, outPtr: number) => number,
  userNumbers: number[]
): Promise<CheckResult | null> {
  // 1. 동기화된 히스토리 데이터를 기반으로 정확한 구조체 배열 크기 계산
  const history = await loadHistoryData()
  const totalRounds = history.length

  // MatchResult 구조체 크기: 8바이트 (#pragma pack(1) 규격)
  const structSize = 8
  const outPtr = mod._malloc(totalRounds * structSize)

  try {
    // 2. 유저 번호 배열(number[])을 C++의 uint64_t 비트셋(bigint)으로 변환
    let userBitset = 0n
    userNumbers.forEach(num => {
      userBitset |= (1n << BigInt(num - 1))
    })

    // 3. WASM 함수 실행 (결과 개수가 found_count 반환됨)
    const foundCount = startFn(userBitset, outPtr)

    if (foundCount < 0) {
      throw new Error(`WASM 검증 에러 코드: ${foundCount}`)
    }

    // 4. C++ 결과 메모리 버퍼 파싱 및 JS 결과 구조 매핑
    const results: LottoResult[] = []

    const rawBuffer =
      (mod.HEAPU8 && mod.HEAPU8.buffer) ||
      (mod.HEAP8 && mod.HEAP8.buffer) ||
      (mod.HEAP32 && mod.HEAP32.buffer) ||
      (mod as any).buffer ||
      (mod as any).asm?.memory?.buffer;

    if (!rawBuffer || !(rawBuffer instanceof ArrayBuffer)) {
      throw new Error("WASM 메모리 버퍼(ArrayBuffer)를 찾을 수 없습니다.");
    }


    // 히스토리를 빠르게 조회하기 위해 Map 변환 (WASM 결과 매핑 최적화)
    const historyMap = new Map(history.map(h => [h.ltEpsd, h]))
    const view = new DataView(rawBuffer);

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
    for (let i = 0; i < foundCount; i++) {
      // 현재 구조체가 시작되는 정확한 절대 바이트 위치 (포인터 시작점 + 오프셋)
      const byteOffset = outPtr + (i * structSize);

      // 2. DataView를 이용해 바이트 오프셋 기준으로 정확하게 값 추출
      // 세 번째 인자 true는 Emscripten(WASM)의 Little-Endian 방식을 따르겠다는 의미입니다.
      const round = view.getUint32(byteOffset, true);         // 처음 4바이트 (uint32_t)
      const matchCount = view.getUint8(byteOffset + 4);            // 5번째 바이트 (uint8_t)
      const hasBonusVal = view.getUint8(byteOffset + 5);            // 6번째 바이트 (uint8_t)
      const rank = view.getUint16(byteOffset + 6, true);     // 마지막 2바이트 (uint16_t)

      const draw = historyMap.get(round);
      if (!draw) continue;

      const winningNumbers = getWinningNumbers(draw);
      const amount =
        rank === 1 ? draw.rnk1WnAmt :
          rank === 2 ? draw.rnk2WnAmt :
            rank === 3 ? draw.rnk3WnAmt :
              rank === 4 ? 50000 : 5000;
      const targetKey = RANK_KEYS[rank - 1];
      prizes[targetKey] += amount;
      prizes.total += amount;

      results.push({
        round,
        numbers: winningNumbers,
        bonusNumber: draw.bnsWnNo,
        matchCount,
        matchedNumbers: userNumbers.filter(n => winningNumbers.includes(n)),
        hasBonusMatch: hasBonusVal === 1,
        rank,
        prize1st: draw.rnk1WnAmt,
        prize2nd: draw.rnk2WnAmt,
        prize3rd: draw.rnk3WnAmt,
      });
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

  } finally {
    // 5. 메모리 할당 해제 (누수 방지 필수)
    mod._free(outPtr)
  }
}

/* =========================================================
 * WASM-ONLY ENGINE (PM1 Universe Simulation)
 * ========================================================= */
export async function computeUniverseWASM(
  mod: WasmEngineModule,
  runPm1Fn: (inPtr: number, outPtr: number) => number,
  userNumbers: number[]
): Promise<UniverseSimulationResult | null> {
  // 1. 입력 번호 6개 오름차순 정렬 보장
  const sortedNumbers = [...userNumbers].sort((a, b) => a - b)

  // 2. 포인터 메모리 할당 (입력 int[6] = 24바이트, 출력 UniverseResult = 44바이트)
  const inPtr = mod._malloc(6 * 4)
  const outPtr = mod._malloc(44)

  try {
    // 3. HEAP32 메모리에 정렬된 입력 번호 세팅 (인덱스 = ByteOffset / 4)
    mod.HEAP32.set(sortedNumbers, inPtr / 4)

    // 4. C-Binding run_pm1_simulation 실행
    const resCode = runPm1Fn(inPtr, outPtr)
    if (resCode !== 0) {
      throw new Error(`WASM 평행우주 시뮬레이션 연산 실패: ${resCode}`)
    }

    // 5. WASM ArrayBuffer 참조
    const rawBuffer =
      (mod.HEAPU8 && mod.HEAPU8.buffer) ||
      (mod.HEAP32 && mod.HEAP32.buffer) ||
      (mod as any).buffer ||
      (mod as any).asm?.memory?.buffer

    if (!rawBuffer || !(rawBuffer instanceof ArrayBuffer)) {
      throw new Error("WASM 메모리 버퍼를 찾을 수 없습니다.")
    }

    const view = new DataView(rawBuffer)

    //  * 64비트 BigInt 비트셋을 로또 번호 배열(1~45)로 복원
    function bitsetToNumbers(bitset: bigint): number[] {
      const numbers: number[] = [];

      for (let i = 1; i <= 45; i++) {
        // (i - 1)번째 비트가 1(SET)인지 확인
        if ((bitset & (1n << BigInt(i - 1))) !== 0n) {
          numbers.push(i);
        }
      }
      return numbers;
    }

    // 6. DataView 44바이트 오프셋 개별 파싱 (Little-Endian)
    return {
      totalCombinations: view.getUint32(outPtr, true),        // offset 0 (uint32)
      rank1Count: view.getUint32(outPtr + 4, true),           // offset 4 (uint32)
      rank2Count: view.getUint32(outPtr + 8, true),           // offset 8 (uint32)
      rank3Count: view.getUint32(outPtr + 12, true),          // offset 12 (uint32)
      rank4Count: view.getUint32(outPtr + 16, true),          // offset 16 (uint32)
      rank5Count: view.getUint32(outPtr + 20, true),          // offset 20 (uint32)
      maxPrize: view.getBigUint64(outPtr + 24, true),         // offset 24 (uint64)
      bestBitset: view.getBigUint64(outPtr + 32, true),       // offset 32 (uint64)
      bestEpisode: view.getUint32(outPtr + 40, true),        // offset 40 (uint32)
      bestCombination: bitsetToNumbers(view.getBigUint64(outPtr + 32, true))
    }
  } finally {
    mod._free(inPtr)
    mod._free(outPtr)
  }
}
