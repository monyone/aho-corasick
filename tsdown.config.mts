import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.mts',
    'src/fast.mts',
    'src/greedy/greedy.mts',
    'src/greedy/fast.mts',
    'src/stream/replace.mts',
    'src/stream/tokenize.mts',
    'src/stream/web/replace-web.mts',
    'src/stream/web/tokenize-web.mts',
    'src/stream/node/replace-node.mts',
  ],
  deps: {
    neverBundle: [/^node:/],
  },
  hash: false,
  unbundle: true,
  format: ['cjs', 'esm'],
  dts: true,
})
