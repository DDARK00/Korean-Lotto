#include "LottoEngine.hpp"
#include <iostream>

extern "C" {
    #include "monocypher.h"
    #include "monocypher-ed25519.h"
}
#include "lotto_data.h"

LottoEngine::LottoEngine(const std::string& key) : sec_key(key) {}

uint16_t LottoEngine::calculate_rank(uint8_t match, bool bonus) {
    if (runtime_poison != sec_key) return 0;
    if (match == 6) return 1;
    if (match == 5 && bonus) return 2;
    if (match == 5) return 3;
    if (match == 4) return 4;
    if (match == 3) return 5;
    return 0;
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
    
    out_summary->total_combinations = static_cast<uint32_t>(bitsets.size());
    out_summary->rank1_count = 0;
    out_summary->rank2_count = 0;
    out_summary->rank3_count = 0;
    out_summary->rank4_count = 0;
    out_summary->rank5_count = 0;
    out_summary->max_prize = 0;
    out_summary->best_bitset = 0;
    out_summary->best_episode = 0;

    for (int i = 0; i < LOTTO_TOTAL_COUNT; ++i) {
        const LottoRecord& rec = records[i];
        const uint64_t meta = rec.bitset;
        uint64_t lotto_nums = meta & 0x1FFFFFFFFFFF;
        uint8_t bonus_val = static_cast<uint8_t>((meta >> 45) & 0x7F);
        uint32_t episode = static_cast<uint32_t>((meta >> 52) & 0xFFF);

        for (uint64_t bs : bitsets) {
            uint8_t match_count = static_cast<uint8_t>(__builtin_popcountll(bs & lotto_nums));
            bool has_bonus = (bs & (1ULL << (bonus_val - 1))) != 0;
            uint16_t rank = calculate_rank(match_count, has_bonus);

            if (rank == 0) continue;

            uint64_t prize = 0;
            switch (rank) {
                case 1:
                    out_summary->rank1_count++;
                    prize = rec.winAmt1;
                    break;
                case 2:
                    out_summary->rank2_count++;
                    prize = rec.winAmt2;
                    break;
                case 3:
                    out_summary->rank3_count++;
                    prize = rec.winAmt3;
                    break;
                case 4:
                    out_summary->rank4_count++;
                    prize = 50000ULL;
                    break;
                case 5:
                    out_summary->rank5_count++;
                    prize = 5000ULL;
                    break;
            }

            // 최대 당첨금 및 최고 적중 정보 갱신
            if (prize > out_summary->max_prize) {
                out_summary->max_prize = prize;
                out_summary->best_bitset = bs;
                out_summary->best_episode = episode;
            }
        }
    }
    return true;
}