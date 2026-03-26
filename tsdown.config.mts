import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.mts',
    'src/fast.mts',
    'src/greedy.mts',
    'src/stream.mts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
})
