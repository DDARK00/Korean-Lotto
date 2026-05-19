import json
import os
from config import DATA_PATH, FE_DATA_PATH

_cached_history = None

def get_history(force_reload=False):
    """메모리에 캐시된 데이터를 반환하거나, 없으면 파일에서 로드합니다."""
    global _cached_history
    
    if _cached_history is None or force_reload:
        if not os.path.exists(DATA_PATH):
            _cached_history = []
            return _cached_history

        try:
            with open(DATA_PATH, 'r', encoding='utf-8') as f:
                _cached_history = json.load(f)
                print(f"DEBUG: 데이터 로드 완료 ({len(_cached_history)} 회차)")
        except (json.JSONDecodeError, FileNotFoundError) as e:
            _cached_history = []
            print(f"CRITICAL: 파일을 읽는 중 예상치 못한 오류 발생: {e}")

            
    return _cached_history

def save_history(data):
    """데이터를 파일에 저장하고 메모리 캐시를 최신화합니다."""
    global _cached_history
    
    # python 사용
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    # fe 파일 동기화
    os.makedirs(os.path.dirname(FE_DATA_PATH), exist_ok=True)
    with open(FE_DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    # 저장 후 캐시 갱신
    _cached_history = data
    print("DEBUG: 데이터 저장 및 캐시 갱신 완료")