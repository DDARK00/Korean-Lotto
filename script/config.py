from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
API_PATH = BASE_DIR / "config" / "api.json"
DATA_PATH = BASE_DIR / "data" / "lotto_history.json"
