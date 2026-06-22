# main.py
import os, sys
from collector import update_lotto_data
from processor import generate_wasm_header
from builder import run_wasm_build

"""
sys.exit(status) 설정값
SUCCESS = 0
FAILURE = 1
SKIPPED = 10
NO_DATA = 11
TIMEOUT = 124
"""
def main():
    print('--- 데이터 파이프라인 시작 ---')
    # 0. json 데이터는 data_manager.py를 통해서 전역으로 관리됨

    # 1. 데이터 수집 및 JSON 갱신(내부에서 data_manager.get_history() 호출)
    # 업데이트가 발생하면 True를 반환
    print('\nStep 1: Updating JSON from API...')
    status = update_lotto_data()
    
    if status != 0: # SUCCESS가 아니면 종료
        print('새로 추가된 데이터가 없으므로 빌드 파이프라인을 종료합니다.')
        #  변경 사항 없으므로 여기서 Actions 종료
        print("이번 회차 데이터가 없으므로 스킵합니다.")
        if status == 10: # Skipped 정상 종료
            sys.exit(0)
        sys.exit(status) # 설정값 그대로 exit

    # Step 2: 비트셋 변환 및 데이터 서명 통합
    # 이 함수 안에서 바이너리 생성 + Ed25519 서명이 모두 일어납니다.
    print('\nStep 2: Converting to bitsets and generating WASM header...')
    bitsets = generate_wasm_header()
    
    if bitsets:
        print('-> Step 2: WASM header 생성 성공.')
    else:
        print('-> Step 2: WASM header 생성 실패! Check logs!')
        sys.exit(1) # [비정상 종료] GHA에 에러를 알려서 빌드를 중단시키고 Retry 트리거

    # 3. Emscripten 빌드 등 CI/CD 작업
    print('\nStep 3: Data preparation complete. Ready for Emscripten build.')  

    # 2. WASM 빌드 실행
    is_build = run_wasm_build()
    if is_build:
        print('-> Step 3: 빌드 및 .js .wasm 생성 성공.')
        print('All python processes completed successfully!')
    else:
        print('-> Step 3: WASM 빌드 실패! Check logs!')
        sys.exit(1) # [비정상 종료] 빌드 실패 시 중단

if __name__ == '__main__':
    main()
