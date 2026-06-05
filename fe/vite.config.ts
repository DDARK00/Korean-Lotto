import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit:0, // 너무 작은 WASM 파일이 base64 문자열로 인라인화되는 것을 방지 (0으로 설정)
  },
  assetsInclude: ['**/*.wasm'], // WASM 파일을 에셋으로 명확히 인식
  // server: {
  //   port: 3000,
  // },
})
