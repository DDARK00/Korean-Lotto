from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
API_PATH = BASE_DIR / "config" / "api.json"
DATA_PATH = BASE_DIR / "data" / "lotto_history.json"
FE_DATA_PATH = BASE_DIR / "fe" / "public" / "data" / "lotto_history.json"
WASM_OUTPUT_PATH = BASE_DIR / "fe" / "src" / "wasm" / "engine.js"
WASM_CPP_PATH = BASE_DIR / "wasm" / "src"
EMSDK_ENV_PATH = BASE_DIR / "emsdk" / "emsdk_env.bat" # 혹은 .sh
HEADER_PATH = BASE_DIR / "wasm" / "src" / "lotto_data.h"
