// src/wasm/wasm-env.d.ts
declare module '*.wasm?url' {
  const value: string;
  export default value;
}