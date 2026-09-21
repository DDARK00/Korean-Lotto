#include <iostream>
#include <emscripten.h>
#include "LottoEngine.hpp"
#include "LottoCombinator.hpp"

#define STR(x) #x
#define XSTR(x) STR(x)

#ifdef SEC_KEY
    const std::string KEY = XSTR(SEC_KEY);
#else
    const std::string KEY = "default_key"; 
#endif

static LottoEngine g_engine(KEY);

int main() {
    // Wasm 모듈 로드 시 서명 무결성 검증 실행
    bool verified = g_engine.init_and_verify_data();

#ifndef __EMSCRIPTEN__
    std::cout << "--- [Native Local Test] ---" << std::endl;
    std::cout << "Data Verification Result: " << (verified ? "SUCCESS" : "FAILED") << std::endl;
#endif

    return 0;
}

extern "C" {
    // 1. 단일 비트셋 대조 C-Binding
    EMSCRIPTEN_KEEPALIVE
    int start_simulation(uint64_t user_bitset, MatchResult* out_results) {
        return g_engine.start_simulation(user_bitset, out_results);
    }

    // 2. ±1 조합 시뮬레이션 C-Binding
    EMSCRIPTEN_KEEPALIVE
    int run_pm1_simulation(const int user_numbers[6], UniverseResult* out_summary) {
        // Combinator에서 변형 조합 비트셋 생성
        auto bitsets = LottoCombinator::generate_pm1_bitsets(user_numbers);
        
        // 데이터 접근 및 연산은 무조건 g_engine 게이트웨이를 경유
        bool success = g_engine.run_parallel_simulation(bitsets, out_summary);
        return success ? 0 : -1;
    }
}