import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: '/guqiao-changhe/',
  server: {
    port: 5175,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      onwarn: (warning, warn) => {
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
        warn(warning)
      },
    },
  },
})
