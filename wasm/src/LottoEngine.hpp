#ifndef LOTTO_ENGINE_HPP
#define LOTTO_ENGINE_HPP

#include <string>
#include <vector>
#include "types.h"

class LottoEngine {
private:
    std::string runtime_poison = "a";
    bool verified = false;
    std::string sec_key;

    uint16_t calculate_rank(uint8_t match, bool bonus);

public:
    explicit LottoEngine(const std::string& key);

    // 데이터 서명 무결성 검증
    bool init_and_verify_data();

    // 단일 비트셋 회차별 대조
    int start_simulation(uint64_t user_bitset, MatchResult* out_results);

    // ±1 변형 비트셋 배열 일괄 통계 대조 (게이트웨이 무결성 검증 포함)
    bool run_parallel_simulation(const std::vector<uint64_t>& bitsets, UniverseResult* out_summary);
};

#endif // LOTTO_ENGINE_HPP