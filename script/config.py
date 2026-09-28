from pathlib import Path
from datetime import datetime, timedelta, timezone

BASE_DIR = Path(__file__).resolve().parents[1]
API_PATH = BASE_DIR / "config" / "api.json"
DATA_PATH = BASE_DIR / "data" / "lotto_history.json"
FE_DATA_PATH = BASE_DIR / "fe" / "public" / "data" / "lotto_history.json"
WASM_OUTPUT_PATH = BASE_DIR / "fe" / "src" / "wasm" / "engine.js"
WASM_CPP_PATH = BASE_DIR / "wasm" / "src"
EMSDK_ENV_PATH = BASE_DIR / "emsdk" / "emsdk_env.bat" # 혹은 .sh
HEADER_PATH = BASE_DIR / "wasm" / "src" / "lotto_data.h"

# 회차 ↔ 추첨일 계산 기준 (매주 토요일 20:35 KST 추첨)
KST = timezone(timedelta(hours=9))
BASE_ROUND = 1222
BASE_DRAW_TIME = datetime(2026, 5, 2, 20, 35, tzinfo=KST)

def get_draw_date(round_no: int):
    """회차 번호로 추첨 일자(date)를 계산합니다."""
    return (BASE_DRAW_TIME + timedelta(weeks=round_no - BASE_ROUND)).date()
