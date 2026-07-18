import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.mts',
    'src/fast.mts',
    'src/greedy/greedy.mts',
    'src/greedy/fast.mts',
    'src/stream/stream.mts',
    'src/stream/web/stream-web.mts',
    'src/stream/node/stream-node.mts',
  ],
  deps: {
    neverBundle: [/^node:/],
  },
  hash: false,
  unbundle: true,
  format: ['cjs', 'esm'],
  dts: true,
})
