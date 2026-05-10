import 'dotenv/config' // load .env into process.env for server-side modules
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import devServer from '@hono/vite-dev-server'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    devServer({
      entry: 'src/index.ts',
      exclude: [
        /^\/@.+$/,
        /.*\.(ts|tsx|jsx|js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/,
        /^\/(public|src|frontend|node_modules|@vite|@react-refresh)\/.+/,
        /^\/$/,
        /^\/login.*$/,
        /^\/register.*$/,
        /^\/verify.*$/,
        /^\/forgot.*$/,
        /^\/reset.*$/,
        /^\/dashboard.*$/,
        /^\/banky.*$/,
        /^\/prijmy.*$/,
        /^\/vydavky.*$/,
        /^\/hypoteky.*$/,
        /^\/nastavenia.*$/,
        /^\/admin.*$/,
      ],
      injectClientScript: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
      '@server': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8787,
    strictPort: true,
  },
})
