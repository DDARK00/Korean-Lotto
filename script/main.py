# main.py
from collector import update_lotto_data
from processor import generate_wasm_header

def main():
    print('--- 데이터 파이프라인 시작 ---')
    # 0. json 데이터는 data_manager.py를 통해서 전역으로 관리됨

    # 1. 데이터 수집 및 JSON 갱신(내부에서 data_manager.get_history() 호출)
    # 업데이트가 발생하면 True를 반환
    print('\nStep 1: Updating JSON from API...')
    is_updated = update_lotto_data()
    
    if not is_updated:
        print('새로 추가된 데이터가 없으므로 빌드 파이프라인을 종료합니다.')
        return # 데이터가 같으면 여기서 Actions 종료

    # Step 2: 비트셋 변환 및 데이터 서명 통합
    # 이 함수 안에서 바이너리 생성 + Ed25519 서명이 모두 일어납니다.
    print('\nStep 2: Converting to bitsets and generating WASM header...')
    bitsets = generate_wasm_header()
    
    if bitsets:
        print('-> Step 2: WASM header 생성 성공.')
    else:
        print('-> Step 2: WASM header 생성 실패! Check logs!')
        return # 실패 시 여기서 중단

    # 3. Emscripten 빌드 등 CI/CD 작업
    print('All python processes completed successfully!')
    print('\nStep 3: Data preparation complete. Ready for Emscripten build.')      

if __name__ == '__main__':
    main()