#ifndef LOTTO_COMBINATOR_HPP
#define LOTTO_COMBINATOR_HPP

#include <vector>
#include <cstdint>

class LottoCombinator {
private:
    // ±1 변형 번호 후보군을 조합하여 64비트 비트셋으로 변환하는 백트래킹 내부 함수
    static void generate_combinations(
        const std::vector<std::vector<int>>& candidates,
        int depth,
        uint64_t current_bitset,
        int last_picked,
        std::vector<uint64_t>& out_bitsets
    );

public:
    // 6개 번호를 입력받아 ±1 조합(최대 3^6=729개)의 bitset vector 반환
    static std::vector<uint64_t> generate_pm1_bitsets(const int user_numbers[6]);
};

#endif // LOTTO_COMBINATOR_HPP