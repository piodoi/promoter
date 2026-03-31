import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 5174,
    },
    build: {
        rollupOptions: {
            output: {
                entryFileNames: 'assets/app.js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: function (assetInfo) {
                    var _a;
                    if ((_a = assetInfo.names) === null || _a === void 0 ? void 0 : _a.some(function (name) { return name.slice(-4) === '.css'; })) {
                        return 'assets/app.css';
                    }
                    return 'assets/[name][extname]';
                },
            },
        },
    },
});
