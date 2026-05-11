from data_manager import get_history, save_history
import json, requests
from config import API_PATH
API_PATH='./config/api.json'

with open(API_PATH,'r',encoding='utf-8') as api_json:
    api=json.load(api_json).get('endpoint')


# 신규 데이터를 통합 처리하는 함수
def update_lotto_data():
    """
    메인 파이프라인에서 호출할 함수.
    새로운 데이터를 성공적으로 가져오면 True, 아니면 False를 반환합니다.
    """

    history_data = get_history() # 전체 데이터를 불러오는 함수
    # 현재 저장된 회차 확인
    saved_latest = max(item['ltEpsd'] for item in history_data) if history_data else 0
    # 마지막 회차 파악
    real_latest = find_latest_lotto_round()

    if saved_latest >= real_latest :
        print('업데이트할 새로운 회차가 없습니다.')
        return

    # 데이터 수집
    new_data = fetch_lotto_batch(real_latest)

    if new_data:
        history_data.append(new_data)

        # 회차별로 정렬
        history_data.sort(key=lambda x: x['ltEpsd'])
        save_history(history_data)
        print(f'✅ 완료: 새로운 {real_latest} 회차 저장 완료!')
        return True
    else:
        print('업데이트할 새로운 데이터가 없습니다.')
        return False


# 실제 최신회차 로또 라운드
def find_latest_lotto_round():
    from datetime import datetime, timedelta, timezone

    KST = timezone(timedelta(hours=9))

    BASE_ROUND = 1222
    BASE_TIME = datetime(2026, 5, 2, 20, 35, tzinfo=KST)

    def get_lotto_round(dt=None):
        dt = (dt or datetime.now(KST)).astimezone(KST)
        return BASE_ROUND + ((dt - BASE_TIME).days // 7)

    result = get_lotto_round()
    return  result

# API 호출 함수
def fetch_lotto_batch(newest):
    target = str(newest)
    url = api + target

    try:
        resp = requests.get(url,timeout=10).json()
        # 리스트에서 첫 번째 아이템(최신회차)만 가져옴
        data_list = resp.get('data', {}).get('list', [])
        if data_list:
            item = data_list[0]
            filtered = {
                'ltEpsd': item.get('ltEpsd'),
                'tm1WnNo': item.get('tm1WnNo'),
                'tm2WnNo': item.get('tm2WnNo'),
                'tm3WnNo': item.get('tm3WnNo'),
                'tm4WnNo': item.get('tm4WnNo'),
                'tm5WnNo': item.get('tm5WnNo'),
                'tm6WnNo': item.get('tm6WnNo'),
                'bnsWnNo': item.get('bnsWnNo'),
                'rnk1WnNope': item.get('rnk1WnNope'),
                'rnk1WnAmt': item.get('rnk1WnAmt'),
                'rnk2WnNope': item.get('rnk2WnNope'),
                'rnk2WnAmt': item.get('rnk2WnAmt'),
                'rnk3WnNope': item.get('rnk3WnNope'),
                'rnk3WnAmt': item.get('rnk3WnAmt'),
            }
            
            if filtered.get('ltEpsd') == newest:
                print(f'{target}회차 수집 성공')
                return filtered

        else:
            print("최신 회차 미등록!")

    except requests.exceptions.RequestException as e:
        print(f"네트워크 오류 발생: {e}")

    return None


if __name__ == '__main__':
    # 단독 테스트용
    update_lotto_data()