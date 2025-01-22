import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/ThinkFlow/',
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'mindmap': ['konva', 'marked'],
          'collaboration': ['yjs', 'y-webrtc', 'y-indexeddb']
        }
      },
      external: ['vue'],
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },
  optimizeDeps: {
    include: ['vue', 'pinia', 'yjs', 'socket.io-client'],
    exclude: []
  }
})
