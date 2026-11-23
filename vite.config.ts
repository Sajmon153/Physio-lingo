import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-three',
                test: /node_modules[\\/]three/,
                priority: 30,
              },
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|scheduler)/,
                priority: 25,
              },
              {
                name: 'vendor-icons',
                test: /node_modules[\\/]lucide-react/,
                priority: 20,
              },
              {
                name: 'data-anatomy',
                test: /src[\\/]data[\\/](anatomyDb|bonyLandmarks|curriculum)/,
                priority: 15,
              },
              {
                name: 'data-clinical',
                test: /src[\\/]data[\\/](clinicalTestsDb|dermatomesMyotomes|nerveMuscleMap|patientCasesDb|biomechanicsDb)/,
                priority: 14,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
