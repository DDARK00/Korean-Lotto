#include <iostream>
#include <vector>
#include <stdint.h>
#include <emscripten.h>
#include <string>
extern "C" {
    #include "monocypher.h"   // monocypher include
    #include "monocypher-ed25519.h"
}
#include "lotto_data.h"  // 파이썬이 생성한 데이터 헤더

// 주입된 SEC_KEY를 문자열로 변환하여 상수에 할당
#define STR(x) #x
#define XSTR(x) STR(x)

#ifdef SEC_KEY
    const std::string KEY = XSTR(SEC_KEY);
#else
    // 만약 주입이 안 되었을 때를 대비한 기본값
    const std::string KEY = "default_key"; 
#endif

// --- 데이터 구조체 (앞의 파이프라인에서 정의한 것) ---
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
#pragma pack(pop)

class LottoEngine {
private:
    std::string runtime_poison = "a";
    bool verified = false;

public:
    inline uint16_t calculate_rank(uint8_t match, bool bonus) {
        // SEC_KEY가 일치하지 않으면 모든 등수를 0(낙첨)으로 처리
        if (runtime_poison != KEY) return 0;
        if (match == 6) return 1;
        if (match == 5 && bonus) return 2;
        if (match == 5) return 3;
        if (match == 4) return 4;
        if (match == 3) return 5;
        return 0;
    }

    // [1] 서명 검증 로직
    bool init_and_verify_data() {
        /**
         * Monocypher Ed25519 검증 함수
         * 매개변수 순서: signature, public_key, message, message_size
         * 반환값: 성공 시 0, 실패 시 0이 아닌 값
         */
        int result = crypto_ed25519_check(
            LOTTO_SIGNATURE,   // 64 bytes
            LOTTO_PUBLIC_KEY,  // 32 bytes
            LOTTO_RAW_DATA,    // 검증할 전체 바이너리 데이터
            sizeof(LOTTO_RAW_DATA)
        );
        if (result == 0) {
            runtime_poison = KEY;
            verified = true;
        } else {
            runtime_poison = "a"; 
            verified = false;
        }
        return verified;
    }

    // [2] 시뮬레이션 시작 (검증 통과 시 호출)
    int start_simulation(uint64_t user_bitset, MatchResult* out_results) {
        if (!verified) {
            std::cerr << "Error: Data integrity check failed! Invalid signature." << std::endl;
            return -1;
        }
        const LottoRecord* records = reinterpret_cast<const LottoRecord*>(LOTTO_RAW_DATA);
        std::cout << "Data verified. Starting simulation for " << LOTTO_TOTAL_COUNT << " rounds..." << std::endl;
        int found_count = 0;

        for (int i = 0; i < LOTTO_TOTAL_COUNT; ++i) {
            const uint64_t meta = records[i].bitset;
            uint64_t lotto_nums = meta & 0x1FFFFFFFFFFF;
            uint8_t bonus_val = (uint8_t)((meta >> 45) & 0x7F);
            uint32_t episode = (uint32_t)((meta >> 52) & 0xFFF);

            uint8_t match_count = (uint8_t)__builtin_popcountll(user_bitset & lotto_nums);
            bool has_bonus = (user_bitset & (1ULL << (bonus_val - 1))) != 0;

            uint16_t rank = calculate_rank(match_count, has_bonus);

            if (rank > 0) {
                out_results[found_count] = {episode, match_count, (uint8_t)(has_bonus ? 1 : 0), rank};
                found_count++;
            }
        }
        std::cout << "[C++ WASM] simulation completed. winning rounds: " << found_count << std::endl;
        return found_count;
    }
};

LottoEngine engine;
int main() {
    // 1. 초기 로드 시 검증 실행
    bool is_ok=engine.init_and_verify_data();

    // 2. 로컬 환경에서만 실행될 테스트 코드
    // Wasm 환경이 아닐 때만 실행되도록 분기 처리
    #ifndef __EMSCRIPTEN__
    std::cout << "--- [Local Test Mode] ---" << std::endl;
    if (!is_ok) {
        std::cerr << "false! 서명 검증 실패: 데이터가 변조되었을 가능성이 있습니다." << std::endl;
        return 1;
    }
    std::cout << "true! 서명 검증 성공: 데이터를 신뢰할 수 있습니다." << std::endl;


    // 테스트용 유저 번호 (예: 1, 2, 3, 4, 5, 6)
    int test_number[6]={1,3,5,7,9,11};
    uint64_t test_user_bitset = 0;

    for(int i=1; i<=6; i++) test_user_bitset |= (1ULL << (test_number[i]-1));

    MatchResult test_results[LOTTO_TOTAL_COUNT];
    int count = engine.start_simulation(test_user_bitset, test_results);

    std::cout << "Simulation complete. Found " << count << " wins." << std::endl;
    for(int i=0; i < count && i < 5; i++) {
        std::cout << "Ep: " << test_results[i].episode << " | Rank: " << (int)test_results[i].rank << std::endl;
    }
    #endif

    return 0;
}

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    int start_simulation(uint64_t user_bitset, MatchResult* out_results) {
        return engine.start_simulation(user_bitset, out_results);
    }
}