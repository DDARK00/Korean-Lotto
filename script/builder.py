import os
import subprocess
import platform
from dotenv import load_dotenv
from config import WASM_OUTPUT_PATH, WASM_CPP_PATH, EMSDK_ENV_PATH
load_dotenv()

def run_wasm_build(sec_key: str = None):
    sec_key = sec_key or os.getenv("SEC_KEY")

    """
    Emscripten을 사용하여 C++ 엔진을 WASM으로 컴파일합니다.
    """
    if not sec_key:
        print("[-] Error: SEC_KEY is required for building.")
        return False

    WASM_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # 1. 빌드 설정 정의
    source_files = ["main.cpp", "monocypher.c", "monocypher-ed25519.c"]
    
    settings = [
        "-O3",
        f'-DSEC_KEY=\"{sec_key}\"',
        "-s EXPORTED_FUNCTIONS=['_main','_start_simulation','_malloc','_free']",
        "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']",
        "-s ALLOW_MEMORY_GROWTH=1",
        "--closure 1",
    ]
    if platform.system() != "Windows":

        settings.append("--strip-all")
    # 2. Emscripten 환경 설정과 빌드 명령어 통합
    command = ["emcc"] + source_files + settings + ["-o", str(WASM_OUTPUT_PATH)]
    emcc_cmd_str = " ".join(command)    

    if os.getenv("GITHUB_ACTIONS") == "true":
        # GitHub Actions 전용: 바로 emcc 호출
        final_command = emcc_cmd_str
    else:
        # 로컬 환경: 환경 설정 스크립트 실행 후 emcc 호출
        # Windows: && 사용 / Mac,Linux: source 및 && 사용
        if platform.system() == "Windows":
            final_command = f'"{str(EMSDK_ENV_PATH)}" && {emcc_cmd_str}'
        else:
            final_command = f'source "{str(EMSDK_ENV_PATH)}" && {emcc_cmd_str}'

    # 3. 빌드 실행
    print(f"[*] Compiling WASM engine...")

    try:
        subprocess.run(final_command, cwd=str(WASM_CPP_PATH), shell=True, check=True,
                       executable="/bin/bash" if platform.system() != "Windows" else None)
        print("[+] Build successful!")
        return True
    except subprocess.CalledProcessError as e:
        print("[-] Build failed! ERROR CODE :", e.returncode)
        
        print("DEBUG : WASM BUILD FAIL!!!")
        # 💡 숨겨진 표준 출력(stdout)과 에러 출력(stderr)을 강제로 로그에 찍기
        print('\n❌ === [WASM BUILD STDOUT] ===')
        print(e.stdout if e.stdout else '(Empty)')

        print('\n❌ === [WASM BUILD STDERR] ===')
        print(e.stderr if e.stderr else '(Empty)')
        return False


if __name__ == '__main__':
    # 단독 테스트용

    run_wasm_build()