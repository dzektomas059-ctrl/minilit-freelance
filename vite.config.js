import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/minilit-freelance/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@supabase/supabase-js'],
          admin: ['./src/views/admin.js'],
          chat: ['./src/views/chat.js'],
        },
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'src/i18n/*.json', dest: 'src/i18n' },
      ],
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
});
