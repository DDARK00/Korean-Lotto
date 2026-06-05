1. vite public 설정
- vite 제약 상, public에서 js코드를 가져오기가 매우 힘들다.
- vite모듈 시스템(의존성 그래프) 제외, 빌드 변환(Transformation) 차단, 캐시 버스팅(해시값) 부재 등의 이유로 src/wasm 폴더 내로 이동

2. engine.js의 HEAP32 누락
연산에 필요한 HEAP32함수가 빌드 이후에 누락되는 현상.
1) 콘솔로 확인한 결과 calledRun, ccall, cwrap, locateFile, _free, _main, _malloc, _start_simulation의 함수는 확인할 수 있었으나 HEAP32는 누락된 상태.
2) Emscripten 빌드 타임에 코드를 압축하는 과정에 Closure Compiler가 겉으로 드러나지 않는 내부 변수라고 판단하고 이름을 a나 $a 같은 랜덤한 문자로 바꿔버린 것으로 추정.
3) 즉, 코드 압축으로 인한 네임 맹글링(Name Mangling) 현상. 이를 방지하기 위해 python의 Emscripten 빌드 타임에 HEAP32 명시.