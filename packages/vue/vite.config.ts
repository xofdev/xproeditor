import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      staticImport: true,
      copyDtsFiles: false,
    }),
  ],
  build: {
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'XProEditorVue',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue', '@xproeditor/core'],
      output: {
        globals: {
          vue: 'Vue',
          '@xproeditor/core': 'XProEditorCore',
        },
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'style.css' : (asset.name ?? 'assets/[name][extname]')),
      },
    },
  },
})
