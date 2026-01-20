
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // This injects the process.env variables into the client-side code during build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
