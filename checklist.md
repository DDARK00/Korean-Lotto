[Python]
1. API fetch
2. bitset build (final state)
3. serialize bitset → bytes
4. sign(bytes)

↓ 배포

[WASM]
5. receive (data + signature)
6. verify(bytes, signature)
7. only if valid → 계산

↓ UI

[FE]
8. WASM to UI(FE) bridge 
9. check (numbers)
10. fallback Engine(js)
11. test components

pip install -r requirements.txt

''' python
python from nacl.signing import SigningKey key="SigningKey.generate()" print("Private (Hex):", key.encode().hex())
'''


# Get the emsdk repo
git clone https://github.com/emscripten-core/emsdk.git

cd emsdk

./emsdk install 1.38.45


./emsdk install latest

./emsdk activate latest
 
source ./emsdk_env.sh

emcc -v



wasm 빌드(window powershell)
emcc main.cpp monocypher.c monocypher-ed25519.c -O3 -DSEC_KEY=12345678 -s EXPORTED_FUNCTIONS=[_main,_start_simulation,_malloc,_free] -s EXPORTED_RUNTIME_METHODS=[ccall,cwrap] -s ALLOW_MEMORY_GROWTH=1 -o ../build/engine.js


emcc main.cpp monocypher.c monocypher-ed25519.c `
  -O3 `
  -flto `
  -DSEC_KEY=12345678 `
  -s EXPORTED_FUNCTIONS=[_main,_start_simulation,_malloc,_free] `
  -s EXPORTED_RUNTIME_METHODS=[ccall,cwrap] `
  -s ALLOW_MEMORY_GROWTH=1 `
  --closure 1 `
  --strip-all `
  -o ../../fe/public/wasm/engine.js


pnpm
# Corepack 활성화 (관리자 권한이 필요할 수 있음)
corepack enable

# 이제 pnpm 사용 가능!
pnpm -v

# 안된다면
npm install -g pnpm

# 설치 확인
pnpm --version





🚀 GitHub Actions(YAML) 작성 핵심 체크리스트
1. 환경 변수 및 시크릿 관리 (Security)
Secrets 주입: SEC_KEY와 같은 민감한 정보는 반드시 GitHub Repo의 Settings > Secrets and variables > Actions에 등록하고 사용하세요.

env 블록 활용: 파이썬 스크립트가 시스템 환경 변수를 읽을 수 있도록 env: 섹션에서 연결해줘야 합니다.

YAML
- name: Run Pipeline
  env:
    SEC_KEY: ${{ secrets.SEC_KEY }} # 시크릿을 환경변수로 매핑
  run: python script/main.py --build
2. 데이터 업데이트 기반 조건부 실행 (Efficiency)
Step ID 활용: 파이썬(main.py)에서 데이터 업데이트 여부를 판단한 뒤, 그 결과를 Actions의 outputs로 내보내면 이후 스텝(빌드, 배포)을 실행할지 말지 결정할 수 있습니다.

if 조건문: if: steps.check_step.outputs.is_updated == 'true'와 같은 조건문을 사용해 불필요한 서버 자원 낭비를 막으세요.

3. Emscripten(emsdk) 세팅
공식 액션 사용: mymindstorm/setup-emsdk 같은 검증된 액션을 사용하여 가상 머신에 emcc 환경을 구축하세요.

캐싱 고려: 빌드 시간을 단축하려면 actions/cache를 사용하여 emsdk 설치 과정을 캐싱할 수 있습니다. (설정은 조금 까다롭지만 속도는 확실히 빨라집니다.)

4. 아티팩트(Artifacts) 및 배포
결과물 보존: 빌드된 engine.js와 engine.wasm은 다음 단계(FE 배포)에서 필요하므로 actions/upload-artifact를 사용해 임시 저장해야 할 수도 있습니다.

권한 설정: GitHub Pages로 배포한다면 permissions 섹션에서 contents: write 혹은 pages: write 권한을 명시해야 합니다.

5. 경로 및 실행 권한
상대 경로 주의: .yml 파일은 프로젝트 루트에서 실행됩니다. 파이썬 스크립트 내부에서 cwd를 사용하여 파일 경로를 제어하고 있는지 확인하세요.

실행 권한: 리눅스 환경(Actions 기본)에서 스크립트 실행 권한 문제가 발생하면 chmod +x 명령어를 추가해야 할 수도 있습니다.

🛠️ 추천하는 YAML 스텝 흐름 (Summary)
Checkout: 코드 내려받기.

Setup Python: 파이썬 환경 구축 및 의존성(python-dotenv 등) 설치.

Setup Emscripten: emcc 컴파일러 설치.

Run Pipeline (The Manager): main.py 실행.

데이터 수집 → 헤더 생성 → builder.py를 통한 WASM 빌드.

Deploy: 생성된 fe/dist 및 Wasm 바이너리를 타겟(GitHub Pages 등)에 배포.