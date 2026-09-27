import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'
export default mergeConfig(base, defineConfig({
  build: {
    outDir: 'dist-demo', emptyOutDir: true, cssCodeSplit: false, assetsInlineLimit: 100_000_000,
    rollupOptions: { output: { inlineDynamicImports: true, manualChunks: undefined } },
  },
}))
