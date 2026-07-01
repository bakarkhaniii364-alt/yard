import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-oxc';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    esbuild: {
      supported: {
        'top-level-await': true,
      },
    },
    exclude: ['dashjs'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico'],
      manifest: false,
      workbox: {
        // Allow larger assets (vendor chunks) to be precached by Workbox.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Never cache private Supabase storage on shared devices
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'COMMONJS_VARIABLE_IN_ESM' && warning.id && warning.id.includes('dashjs')) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (!id) return;
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor';
            if (id.includes('@supabase/supabase-js')) return 'supabase';
            if (id.includes('@tiptap/react') || id.includes('@tiptap/starter-kit')) return 'tiptap';
            if (id.includes('yjs') || id.includes('y-webrtc')) return 'webrtc';
            if (id.includes('lucide-react')) return 'lucide';
          }
        },
      },
    },
  },
}));
