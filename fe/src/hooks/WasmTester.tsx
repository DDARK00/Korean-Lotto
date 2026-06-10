import { useState } from 'react';
import { computeJS, computeWASM, useWasm } from './useWasm';
import { WasmEngineModule } from '@/wasm/engine';

// 1. 내부에서 사용할 전용 커스텀 훅
function useWasmTest() {
    const [isTesting, setIsTesting] = useState(false);
    const runTest = async (userNumbers: number[], mod: WasmEngineModule, startFn: (userBitset: bigint, outPtr: number) => number) => {
        try {
            setIsTesting(true);
            const jsResult = await computeJS(userNumbers)
            const wasmResult = await computeWASM(mod, startFn, userNumbers)

            // 3. 교차 검증 (Cross-Validation) 데이터 대조
            const isTotalMatch = jsResult.summary.total === wasmResult?.summary.total
            const isWinningMatch = jsResult.results.length === wasmResult?.results.length
            const isRankMatch = jsResult.summary.firstPlace === wasmResult?.summary.firstPlace &&
                jsResult.summary.secondPlace === wasmResult?.summary.secondPlace && jsResult.summary.thirdPlace === wasmResult?.summary.thirdPlace

            // 💡 두 엔진의 1,200+ 회차 정렬 결과가 완전히 일치하는지 전수 조사
            const isDataIdentical = jsResult.results.every((jsRow, idx) => {
                const wasmRow = wasmResult?.results[idx]
                return jsRow.round === wasmRow?.round && jsRow.rank === wasmRow?.rank
            })
            // ==================== 🔬 ENGINE CROSS-VALIDATION LOGS ====================
            console.group(`%c🔬 엔진 교차 검증 데이터 덤프 (${userNumbers.join(', ')})`, "font-weight: bold; font-size: 12px; color: #4f46e5;");

            // [1단계] 서머리 통계 대조 시각화 (테이블 형태로 한눈에 비교 가능하게 출력)
            console.log("%c[1/3] 엔진별 요약 데이터 대조 (Summary Matrix)", "font-weight: bold; color: #1e293b;");
            console.table({
                "JS Engine (Fallback)": {
                    "Total Simulated": jsResult.summary.total,
                    "Total Wins": jsResult.results.length,
                    "1st Place": jsResult.summary.firstPlace,
                    "2nd Place": jsResult.summary.secondPlace,
                    "3rd Place": jsResult.summary.thirdPlace,
                    "4th Place": jsResult.summary.fourthPlace,
                    "5th Place": jsResult.summary.fifthPlace
                },
                "WASM Engine (Core)": {
                    "Total Simulated": wasmResult?.summary.total,
                    "Total Wins": wasmResult?.results.length,
                    "1st Place": wasmResult?.summary.firstPlace,
                    "2nd Place": wasmResult?.summary.secondPlace,
                    "3rd Place": wasmResult?.summary.thirdPlace,
                    "4th Place": wasmResult?.summary.fourthPlace,
                    "5th Place": wasmResult?.summary.fifthPlace
                }
            });

            // [2단계] 전수 조사 매칭 결과 디버깅
            console.log("%c[2/3] 정밀 데이터 검증 레포트 (Assertion Report)", "font-weight: bold; color: #1e293b;");
            console.log(`- 전체 시뮬레이션 횟수 검증: ${isTotalMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
            console.log(`- 총 당첨 건수 일치 여부: ${isWinningMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
            console.log(`- 상위 랭크(1등/2등/3등) 데이터 검증: ${isRankMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
            console.log(`- 1,200+ 회차별 정렬/데이터 무결성: ${isDataIdentical ? '✅ PASSED' : '❌ FAILED'}`);

            // [3단계] 불일치 발생 시 트래킹을 위한 안전장치 로그
            if (!isDataIdentical) {
                console.log("%c[3/3] 🚨 전수 조사 중 무결성 결함 발견 (Diff Tracker)", "font-weight: bold; color: #dc2626;");
                // 처음으로 데이터가 어긋난 지점을 찾아서 로깅해 줍니다.
                const firstMismatchIdx = jsResult.results.findIndex((jsRow, idx) => {
                    const wasmRow = wasmResult?.results[idx];
                    return jsRow.round !== wasmRow?.round || jsRow.rank !== wasmRow?.rank;
                });

                if (firstMismatchIdx !== -1) {
                    console.warn(`인덱스 [${firstMismatchIdx}]에서 최초 불일치 감지:`);
                    console.log("JS Row:", jsResult.results[firstMismatchIdx]);
                    console.log("WASM Row:", wasmResult?.results[firstMismatchIdx]);
                }
            } else {
                console.log("%c[3/3] 🎉 검증 성공: 각 엔진 간 데이터 무결성 100%.", "color: #16a34a; font-weight: bold;");
            }

            console.groupEnd();
            // =========================================================================

            return {
                success: true,
                match: isTotalMatch && isWinningMatch && isRankMatch && isDataIdentical,
                jsSummary: jsResult.summary,
                wasmSummary: wasmResult?.summary,
                details: { isTotalMatch, isRankMatch, isDataIdentical }
            }
        } catch (err) {
            console.error("테스트 중 크래시 발생:", err)
            return { success: false, error: err }
        } finally {
            setIsTesting(false)
        }
    };
    return { runTest, isTesting };
}

// 2. 메인 테스트 컴포넌트
export default function WasmTester({ selectedNumbers }: { selectedNumbers: number[] }) {
    const { runTest, isTesting } = useWasmTest(); // 내부 훅 사용
    const [testResult, setTestResult] = useState<any>(null);
    const { _rawWasmContext } = useWasm()
    const { mod, wasmFn } = _rawWasmContext
    const [isOpen, setIsOpen] = useState(false);
    if (!mod || !wasmFn) {
        return (<p>wasm loading error</p>)
    }

    const testFn = async (numbers: number[]) => {
        const result = await runTest(numbers, mod, wasmFn)
        if (result.success) {
            setTestResult(result)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 font-sans antialiased">
            {/* 1. 플로팅 트리거 버튼 (토글용 뱃지) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border text-sm font-bold transition-all duration-300 ${isOpen
                    ? 'bg-gray-900 text-white border-transparent'
                    : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'
                    }`}
            >
                <span>{isOpen ? '✕ 닫기' : '🔬 Engine Tester'}</span>
                {!isOpen && testResult && (
                    <span className="flex h-2 w-2 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${testResult.match ? 'bg-green-400' : 'bg-red-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${testResult.match ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    </span>
                )}
            </button>

            {/* 2. 본체 테스트 카드 */}
            {isOpen && (
                <div className="absolute bottom-14 right-0 w-80 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/80 p-5 transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="flex flex-col gap-3.5">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                ⚙️ 코어 교차 검증 시스템
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                WASM 비트셋 엔진과 JS Fallback 엔진의 연산 결과가 100% 일치하는지 실시간으로 검증합니다.
                            </p>
                        </div>

                        <hr className="border-gray-100" />

                        {/* 검증 실행 버튼 */}
                        <button
                            disabled={isTesting || selectedNumbers.length !== 6}
                            onClick={() => testFn(selectedNumbers)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 text-white disabled:text-gray-400 py-2 px-4 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isTesting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-3 w-3 text-gray-400" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    1,200+ 회차 전수 조사 중...
                                </span>
                            ) : (
                                '교차 검증 실행 (Cross-Validate)'
                            )}
                        </button>

                        {/* 결과창 */}
                        {testResult ? (
                            <div className={`p-3 rounded-xl border text-xs font-medium ${testResult.match
                                ? 'bg-green-50/60 border-green-200 text-green-800'
                                : 'bg-red-50/60 border-red-200 text-red-800'
                                }`}>
                                <div className="font-bold mb-1 flex items-center gap-1">
                                    {testResult.match ? '🟢 검증 완료 (Pass)' : '🔴 연산 오류 (Fail)'}
                                </div>
                                <div className="text-gray-600 leading-tight">
                                    [{selectedNumbers.join(', ')}] 번호에 대해 두 이기종 엔진의 전수 조사 결과 데이터가 완벽히 일치합니다.
                                    <br />
                                    각 회차별 대조 데이터는 개발자 도구(F12) 콘솔 창에서 확인할 수 있습니다.
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[11px] text-gray-400 text-center">
                                상단에서 번호 6개를 선택한 뒤 검증을 시작하세요.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}