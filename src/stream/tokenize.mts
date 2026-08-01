import { AbstractStreamAhoCorasick, Trie } from "./base.mts";
import Collector from "./collector.mts";
import Deque from "./deque.mts";
import RingBuffer from "./ringbuffer.mts";
import type { BoundaryFunc, Match } from "./base.mts";

export type { Match } from './base.mts';

export class AhoCorasick extends AbstractStreamAhoCorasick {
  constructor(keywords: string[]) {
    super(keywords);
  }

  public *tokenizeSync<T, K>(iterable: Iterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, boundary?: BoundaryFunc): Iterable<T | K> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state: Trie = this.root;
    let confirmed_offset = 0;

    for (const text of iterable) {
      [state, confirmed_offset] = yield* this.processTextSync(state, deque, ring, text, confirmed_offset, collector, collect, detect, boundary);
    }
    yield* this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary);
  }

  public async *tokenizeAsync<T, K>(iterable: AsyncIterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, boundary?: BoundaryFunc): AsyncIterable<T | K> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state: Trie = this.root;
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, confirmed_offset] = yield* this.processTextSync(state, deque, ring, text, confirmed_offset, collector, collect, detect, boundary);
    }
    yield* this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary);
  }
}

