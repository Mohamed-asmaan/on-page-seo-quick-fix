import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, existsSync, unlinkSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'copy-files',
      writeBundle() {
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'public/manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        )
        // Copy Icon_1.png as icon.png (official icon)
        copyFileSync(
          resolve(__dirname, 'public/Icon_1.png'),
          resolve(__dirname, 'dist/icon.png')
        )
        // Remove Icon_1.png from dist (we only want icon.png)
        const icon1Path = resolve(__dirname, 'dist/Icon_1.png')
        if (existsSync(icon1Path)) {
          unlinkSync(icon1Path)
        }
      }
    }
  ],
  publicDir: false,
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background.js')
      },
      output: {
        entryFileNames: chunk => {
          return chunk.name === 'popup' ? 'popup.js' : '[name].js'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.html') {
            return 'index.html'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})
