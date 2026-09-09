#include "LottoCombinator.hpp"
#include <algorithm>
#include <set>

void LottoCombinator::generate_combinations(
    const std::vector<std::vector<int>>& candidates,
    int depth,
    uint64_t current_bitset,
    int last_picked,
    std::vector<uint64_t>& out_bitsets
) {
    if (depth == 6) {
        out_bitsets.push_back(current_bitset);
        return;
    }

    for (int num : candidates[depth]) {
        // 중복 번호 방지 및 오름차순 유지 (비트셋 고유성 보장)
        if (num > last_picked) {
            uint64_t next_bitset = current_bitset | (1ULL << (num - 1));
            generate_combinations(candidates, depth + 1, next_bitset, num, out_bitsets);
        }
    }
}

std::vector<uint64_t> LottoCombinator::generate_pm1_bitsets(const int user_numbers[6]) {
    int sorted_nums[6];
    std::copy(user_numbers, user_numbers + 6, sorted_nums);
    std::sort(sorted_nums, sorted_nums + 6);

    std::vector<std::vector<int>> candidates(6);
    for (int i = 0; i < 6; ++i) {
        std::set<int> unique_nums;
        int base = user_numbers[i];
        
        // 1~45 범위 내에서 -1, 0, +1 추출
        if (base - 1 >= 1)  unique_nums.insert(base - 1);
        if (base >= 1 && base <= 45) unique_nums.insert(base);
        if (base + 1 <= 45) unique_nums.insert(base + 1);

        candidates[i] = std::vector<int>(unique_nums.begin(), unique_nums.end());
    }

    std::vector<uint64_t> result_bitsets;
    result_bitsets.reserve(729); // 3^6 최대로 메모리 선점

    generate_combinations(candidates, 0, 0ULL, 0, result_bitsets);
    return result_bitsets;
}