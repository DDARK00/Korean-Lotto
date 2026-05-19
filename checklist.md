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