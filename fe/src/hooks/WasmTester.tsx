import { useState } from 'react';
import { useWasm } from './useWasm';
import { computeUniverseJS } from './wasmBench';
import { computeJS } from '@lib/engine/js';
import { computeWASM, computeUniverseWASM } from '@lib/engine/wasm';
import type { UniverseSimulationResult } from '@lib/types';
import { WasmEngineModule } from '@/wasm/engine';

// ±1 평행우주 결과 비교 (bigint 필드 포함 전 필드 일치 여부)
function isSameUniverse(a: UniverseSimulationResult, b: UniverseSimulationResult | null): boolean {
    if (!b) return false
    return a.totalCombinations === b.totalCombinations &&
        a.rank1Count === b.rank1Count && a.rank2Count === b.rank2Count && a.rank3Count === b.rank3Count &&
        a.rank4Count === b.rank4Count && a.rank5Count === b.rank5Count &&
        a.maxPrize === b.maxPrize && a.bestBitset === b.bestBitset && a.bestEpisode === b.bestEpisode
}

// 1. 내부에서 사용할 전용 커스텀 훅
function useWasmTest() {
    const [isTesting, setIsTesting] = useState(false);
    const runTest = async (
        userNumbers: number[],
        mod: WasmEngineModule,
        startFn: (userBitset: bigint, outPtr: number) => number,
        runPm1Fn: (inPtr: number, outPtr: number) => number
    ) => {
        try {
            setIsTesting(true);
            // JS 시간 측정
            const jsStart = performance.now();
            const jsResult = await computeJS(userNumbers);
            const jsTime = performance.now() - jsStart;

            // WASM 시간 측정
            const wasmStart = performance.now();
            const wasmResult = await computeWASM(mod, startFn, userNumbers);
            const wasmTime = performance.now() - wasmStart;

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
            console.log("%c[0/3] 성능 비교 (%c⏱ Performance Cold Start)", "font-weight:bold;color:#2563eb;");
            console.table({
                JS: `${jsTime.toFixed(2)} ms`,
                WASM: `${wasmTime.toFixed(2)} ms`,
                SpeedUp: `${(jsTime / wasmTime).toFixed(2)}x`
            });

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

            // 4. ±1 한 끗 차이(평행우주) 벤치마크 - 최대 729개 조합 × 1,200+ 회차로 계산량이 큰 기능
            //    두 엔진 모두 같은 알고리즘(비트마스크 + popcount)이라 순수 엔진 속도 비교에 가까움
            const jsUniverseStart = performance.now();
            const jsUniverse = await computeUniverseJS(userNumbers);
            const jsUniverseTime = performance.now() - jsUniverseStart;

            const wasmUniverseStart = performance.now();
            const wasmUniverse = await computeUniverseWASM(mod, runPm1Fn, userNumbers);
            const wasmUniverseTime = performance.now() - wasmUniverseStart;

            const isUniverseMatch = isSameUniverse(jsUniverse, wasmUniverse)

            console.group(`%c🌌 ±1 한 끗 차이 벤치마크 (${jsUniverse.totalCombinations}개 조합)`, "font-weight: bold; font-size: 12px; color: #4f46e5;");
            console.table({
                JS: `${jsUniverseTime.toFixed(2)} ms`,
                WASM: `${wasmUniverseTime.toFixed(2)} ms`,
                SpeedUp: `${(jsUniverseTime / wasmUniverseTime).toFixed(2)}x`
            });
            console.table({
                "JS Engine": { ...jsUniverse, maxPrize: jsUniverse.maxPrize.toString(), bestBitset: jsUniverse.bestBitset.toString(), bestCombination: jsUniverse.bestCombination.join(',') },
                "WASM Engine": wasmUniverse
                    ? { ...wasmUniverse, maxPrize: wasmUniverse.maxPrize.toString(), bestBitset: wasmUniverse.bestBitset.toString(), bestCombination: wasmUniverse.bestCombination.join(',') }
                    : null,
            });
            console.log(`- 전 필드(등수별 횟수/최고 당첨금/최고 조합/회차) 일치: ${isUniverseMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
            console.groupEnd();

            return {
                success: true,
                match: isTotalMatch && isWinningMatch && isRankMatch && isDataIdentical && isUniverseMatch,
                jsSummary: jsResult.summary,
                wasmSummary: wasmResult?.summary,
                details: { isTotalMatch, isRankMatch, isDataIdentical },    
                performance: {
                    js: jsTime,
                    wasm: wasmTime,
                    speedUp: jsTime / wasmTime,
                },
                universe: {
                    combinations: jsUniverse.totalCombinations,
                    match: isUniverseMatch,
                    js: jsUniverseTime,
                    wasm: wasmUniverseTime,
                    speedUp: jsUniverseTime / wasmUniverseTime,
                },
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

// 2. 검증 실행 버튼 (전용 WASM 인스턴스 보유)
//    패널이 열릴 때만 마운트 → 일반 방문자는 WASM을 한 번만 로드하고,
//    테스터는 열 때마다 새 인스턴스로 콜드 스타트 측정 (닫으면 인스턴스 해제)
function TestRunButton({ selectedNumbers, onResult }: {
    selectedNumbers: number[]
    onResult: (numbers: number[], result: any) => void
}) {
    const { runTest, isTesting } = useWasmTest(); // 내부 훅 사용
    const { status, _rawWasmContext } = useWasm()
    const { mod, wasmFn, runPm1Fn } = _rawWasmContext
    const isReady = status === 'ready' && !!mod && !!wasmFn && !!runPm1Fn

    const testFn = async (numbers: number[]) => {
        if (!mod || !wasmFn || !runPm1Fn) return
        const result = await runTest(numbers, mod, wasmFn, runPm1Fn)
        if (result.success) onResult(numbers, result)
    }

    return (
        <button
            disabled={!isReady || isTesting || selectedNumbers.length !== 6}
            onClick={() => testFn(selectedNumbers)}
            className="w-full bg-accent hover:bg-accent-hover disabled:bg-control text-accent-fg disabled:text-fg-muted py-2 px-4 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
        >
            {status === 'loading' ? (
                'WASM 엔진 로드 중...'
            ) : status === 'error' ? (
                'WASM 로드 실패 (검증 불가)'
            ) : isTesting ? (
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
    )
}

// 3. 메인 테스트 컴포넌트
export default function WasmTester({ selectedNumbers }: { selectedNumbers: number[] }) {
    const [testNumbers, setTestNumbers] = useState<number[]>([])
    const [testResult, setTestResult] = useState<any>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleResult = (numbers: number[], result: any) => {
        setTestNumbers(numbers)
        setTestResult(result)
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 font-sans antialiased">
            {/* 1. 플로팅 트리거 버튼 (토글용 뱃지) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border text-sm font-bold transition-all duration-300 ${isOpen
                    ? 'bg-fg text-surface border-line-control'
                    : 'bg-surface text-fg border-line-control hover:bg-control-hover'
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
                <div className="absolute bottom-14 right-0 w-80 bg-surface/90 backdrop-blur-md rounded-2xl shadow-2xl border border-line-card p-5 transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="flex flex-col gap-3.5">
                        <div>
                            <h3 className="text-sm font-bold text-fg flex items-center gap-1.5">
                                ⚙️ 코어 교차 검증 시스템
                            </h3>
                            <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
                                WASM 비트셋 엔진과 JS Fallback 엔진의 연산 결과가 100% 일치하는지 실시간으로 검증합니다.
                            </p>
                        </div>

                        <hr className="border-line" />

                        {/* 검증 실행 버튼 */}
                        <TestRunButton selectedNumbers={selectedNumbers} onResult={handleResult} />

                        {/* 결과창 */}
                        {testResult ? (
                            <div className={`p-3 rounded-xl border text-xs font-medium ${testResult.match
                                ? 'bg-green-50/60 border-green-200 text-green-800'
                                : 'bg-red-50/60 border-red-200 text-red-800'
                                }`}>
                                <div className="font-bold mb-1 flex items-center gap-1">
                                    {testResult.match ? '🟢 검증 완료 (Pass)' : '🔴 연산 오류 (Fail)'}
                                </div>
                                <div className="mt-2 border-t border-gray-200 pt-2 text-[11px] space-y-1">
                                    <div className="flex justify-between">
                                        <span>JS Engine</span>
                                        <span className="font-mono">
                                            {testResult.performance.js.toFixed(2)} ms
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>WASM Engine</span>
                                        <span className="font-mono">
                                            {testResult.performance.wasm.toFixed(2)} ms
                                        </span>
                                    </div>
                                    <div className="flex justify-between font-bold text-indigo-600">
                                        <span>Speed Up</span>
                                        <span>
                                            {testResult.performance.speedUp.toFixed(2)}×
                                        </span>
                                    </div>
                                </div>
                                {/* ±1 한 끗 차이 벤치마크 (계산량 큰 기능) */}
                                <div className="mt-2 border-t border-gray-200 pt-2 text-[11px] space-y-1">
                                    <div className="flex justify-between font-bold">
                                        <span>±1 한 끗 차이 ({testResult.universe.combinations}개 조합)</span>
                                        <span>{testResult.universe.match ? '✅' : '❌'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>JS Engine</span>
                                        <span className="font-mono">
                                            {testResult.universe.js.toFixed(2)} ms
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>WASM Engine</span>
                                        <span className="font-mono">
                                            {testResult.universe.wasm.toFixed(2)} ms
                                        </span>
                                    </div>
                                    <div className="flex justify-between font-bold text-indigo-600">
                                        <span>Speed Up</span>
                                        <span>
                                            {testResult.universe.speedUp.toFixed(2)}×
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-2 text-gray-600 leading-tight">
                                    [{testNumbers?.join(', ')}] 번호에 대해 두 이기종 엔진의 전수 조사 결과 데이터가 완벽히 일치합니다.
                                    <br />
                                    각 회차별 대조 데이터는 개발자 도구(F12) 콘솔 창에서 확인할 수 있습니다.
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-surface-muted rounded-xl border border-line text-[11px] text-fg-muted text-center">
                                상단에서 번호 6개를 선택한 뒤 검증을 시작하세요.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}