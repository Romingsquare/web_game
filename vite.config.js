import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: 'client',
    base: mode === 'production' ? '/web_game/' : '/',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    define: {
      // Expose VITE_WS_URL to client bundle
      'import.meta.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL || ''),
    },
    server: {
      proxy: {
        '/ws': { target: 'ws://localhost:9001', ws: true },
      },
    },
  };
});
