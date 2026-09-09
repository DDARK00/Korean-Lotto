#ifndef LOTTO_TYPES_H
#define LOTTO_TYPES_H

#include <cstdint>

#pragma pack(push, 1)

// RAW DATA 바이너리 레코드 매핑 (8바이트 비트셋 + 8바이트 당첨금 * 3)
struct LottoRecord {
    uint64_t bitset;
    uint64_t winAmt1;
    uint64_t winAmt2;
    uint64_t winAmt3;
};

// 단일 비트셋 대조 결과
struct MatchResult {
    uint32_t episode;    // 회차
    uint8_t match_count; // 맞은 개수
    uint8_t has_bonus;   // 보너스 번호 적중 여부 (1 or 0)
    uint16_t rank;       // 등수 (1~5)
};

// ±1 평행우주 시뮬레이션 집계 결과 (총 44바이트)
struct UniverseResult {
    uint32_t total_combinations; // offset 0  (4바이트)
    uint32_t rank1_count;        // offset 4  (4바이트)
    uint32_t rank2_count;        // offset 8  (4바이트)
    uint32_t rank3_count;        // offset 12 (4바이트)
    uint32_t rank4_count;        // offset 16 (4바이트)
    uint32_t rank5_count;        // offset 20 (4바이트)
    uint64_t max_prize;          // offset 24 (8바이트)
    uint64_t best_bitset;        // offset 32 (8바이트)
    uint32_t best_episode;       // offset 40 (4바이트)
};
#pragma pack(pop)

#endif // LOTTO_TYPES_H