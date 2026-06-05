// src/wasm/engine.d.ts

export interface WasmEngineModule {
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => (...args: any[]) => any;
  ccall: (ident: string, returnType: string | null, argTypes: string[], args: any[]) => any;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  // HEAP32 등 Emscripten 내부 객체 접근을 위해 유연성 확보
  [key: string]: any; 
}

type CreateModule = (options?: any) => Promise<WasmEngineModule>;
const createModule: CreateModule;
export default createModule;