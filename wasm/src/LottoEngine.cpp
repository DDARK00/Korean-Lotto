#include "LottoEngine.hpp"
#include <iostream>

extern "C" {
    #include "monocypher.h"
    #include "monocypher-ed25519.h"
}
#include "lotto_data.h"

LottoEngine::LottoEngine(const std::string& key) : sec_key(key) {}

uint16_t LottoEngine::rank_of(uint8_t match, bool bonus) {
    if (match == 6) return 1;
    if (match == 5 && bonus) return 2;
    if (match == 5) return 3;
    if (match == 4) return 4;
    if (match == 3) return 5;
    return 0;
}

uint16_t LottoEngine::calculate_rank(uint8_t match, bool bonus) {
    if (runtime_poison != sec_key) return 0;
    return rank_of(match, bonus);
}

bool LottoEngine::init_and_verify_data() {
    int result = crypto_ed25519_check(
        LOTTO_SIGNATURE,
        LOTTO_PUBLIC_KEY,
        LOTTO_RAW_DATA,
        sizeof(LOTTO_RAW_DATA)
    );

    if (result == 0) {
        runtime_poison = sec_key;
        verified = true;
    } else {
        runtime_poison = "a";
        verified = false;
    }
    return verified;
}

int LottoEngine::start_simulation(uint64_t user_bitset, MatchResult* out_results) {
    if (!verified || runtime_poison != sec_key) {
        std::cerr << "[LottoEngine Error] Data verification failed." << std::endl;
        return -1;
    }

    const LottoRecord* records = reinterpret_cast<const LottoRecord*>(LOTTO_RAW_DATA);
    int found_count = 0;

    for (int i = 0; i < LOTTO_TOTAL_COUNT; ++i) {
        const uint64_t meta = records[i].bitset;
        uint64_t lotto_nums = meta & 0x1FFFFFFFFFFF;
        uint8_t bonus_val = static_cast<uint8_t>((meta >> 45) & 0x7F);
        uint32_t episode = static_cast<uint32_t>((meta >> 52) & 0xFFF);

        uint8_t match_count = static_cast<uint8_t>(__builtin_popcountll(user_bitset & lotto_nums));
        bool has_bonus = (user_bitset & (1ULL << (bonus_val - 1))) != 0;

        uint16_t rank = calculate_rank(match_count, has_bonus);

        if (rank > 0) {
            out_results[found_count] = {episode, match_count, static_cast<uint8_t>(has_bonus ? 1 : 0), rank};
            found_count++;
        }
    }
    return found_count;
}

bool LottoEngine::run_parallel_simulation(const std::vector<uint64_t>& bitsets, UniverseResult* out_summary) {
    if (!verified || runtime_poison != sec_key) {
        std::cerr << "[LottoEngine Error] Gateway Blocked: Unverified Data Access!" << std::endl;
        return false;
    }

    const LottoRecord* records = reinterpret_cast<const LottoRecord*>(LOTTO_RAW_DATA);
    
    // 집계는 지역 변수에 누적 후 마지막에 한 번만 기록
    // (out_summary 포인터에 직접 누적하면 별칭 가능성 때문에 매 적중마다 메모리 쓰기가 발생)
    uint32_t rank1_count = 0;
    uint32_t rank2_count = 0;
    uint32_t rank3_count = 0;
    uint32_t rank4_count = 0;
    uint32_t rank5_count = 0;
    uint64_t max_prize = 0;
    uint64_t best_bitset = 0;
    uint32_t best_episode = 0;

    for (int i = 0; i < LOTTO_TOTAL_COUNT; ++i) {
        const LottoRecord& rec = records[i];
        const uint64_t meta = rec.bitset;
        uint64_t lotto_nums = meta & 0x1FFFFFFFFFFF;
        uint8_t bonus_val = static_cast<uint8_t>((meta >> 45) & 0x7F);
        uint32_t episode = static_cast<uint32_t>((meta >> 52) & 0xFFF);

        for (uint64_t bs : bitsets) {
            uint8_t match_count = static_cast<uint8_t>(__builtin_popcountll(bs & lotto_nums));
            bool has_bonus = (bs & (1ULL << (bonus_val - 1))) != 0;
            // 게이트(verified + runtime_poison)는 함수 진입부에서 이미 검사함.
            // WASM은 단일 스레드라 이 루프 도중 runtime_poison / sec_key 가 바뀔 수 없으므로
            // 조합마다 calculate_rank 의 문자열 비교(memcmp)를 반복하지 않고 rank_of 를 사용
            uint16_t rank = rank_of(match_count, has_bonus);

            if (rank == 0) continue;

            uint64_t prize = 0;
            switch (rank) {
                case 1:
                    rank1_count++;
                    prize = rec.winAmt1;
                    break;
                case 2:
                    rank2_count++;
                    prize = rec.winAmt2;
                    break;
                case 3:
                    rank3_count++;
                    prize = rec.winAmt3;
                    break;
                case 4:
                    rank4_count++;
                    prize = 50000ULL;
                    break;
                case 5:
                    rank5_count++;
                    prize = 5000ULL;
                    break;
            }

            // 최대 당첨금 및 최고 적중 정보 갱신
            if (prize > max_prize) {
                max_prize = prize;
                best_bitset = bs;
                best_episode = episode;
            }
        }
    }

    out_summary->total_combinations = static_cast<uint32_t>(bitsets.size());
    out_summary->rank1_count = rank1_count;
    out_summary->rank2_count = rank2_count;
    out_summary->rank3_count = rank3_count;
    out_summary->rank4_count = rank4_count;
    out_summary->rank5_count = rank5_count;
    out_summary->max_prize = max_prize;
    out_summary->best_bitset = best_bitset;
    out_summary->best_episode = best_episode;
    return true;
}