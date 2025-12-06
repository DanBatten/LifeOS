import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/repositories/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['@lifeos/core'],
});
