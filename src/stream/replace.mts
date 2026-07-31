import { AbstractStreamAhoCorasick, Trie } from "./base.mts";
import Collector from "./collector.mts";
import Deque from "./deque.mts";
import RingBuffer from "./ringbuffer.mts";
import type { BoundaryFunc, Match } from "./base.mts";

type ReplaceFunc = ((detect: string) => (string | false));
type AsyncableReplaceFunc = ((detect: string) => Promise<ReturnType<ReplaceFunc>> | ReturnType<ReplaceFunc>);
export type Replacer = Record<string, string> | Map<string, string> | ReplaceFunc;
export type AsyncableReplacer = Replacer | AsyncableReplaceFunc;
export type { Match } from './base.mts';

export const handleReplacer = (detect: string, replacer: Replacer): string => {
  if (replacer instanceof Map) {
    return replacer.get(detect) ?? detect;
  } else if (typeof(replacer) === 'object') {
    if (Object.prototype.hasOwnProperty.call(replacer, detect)) {
      return replacer[detect] ?? detect;
    } else {
      return detect;
    }
  } else {
    const replaced = replacer(detect);
    return replaced !== false ? replaced ?? detect : detect;
  }
};

export const handleAsyncableReplacer = (detect: string, replacer: AsyncableReplacer): string | Promise<string> => {
  if (replacer instanceof Map) {
    return replacer.get(detect) ?? detect;
  } else if (typeof(replacer) === 'object') {
    if (Object.prototype.hasOwnProperty.call(replacer, detect)) {
      return replacer[detect] ?? detect;
    } else {
      return detect;
    }
  } else {
    const replaced = replacer(detect);
    if (replaced instanceof Promise) {
      return replaced.then((replaced) => {
        return replaced !== false ? replaced ?? detect: detect;
      });
    } else {
      return replaced !== false ? replaced ?? detect: detect;
    }
  }
};

export const Replacer = {
  Keep: () => (() => false),
  Delete: () => (() => ''),
  Mask: (ch: string) => ((str: string) => ch.repeat(str.length)),
  Once: (replacer: Replacer) => {
    const set = new Set<string>();
    return (str: string) => {
      if (set.has(str)) { return false; }
      set.add(str);
      return handleReplacer(str, replacer);
    };
  },
} as const satisfies Record<string, (...args: any[]) => Replacer>;

export const AsyncableReplacer = {
  ... Replacer,
  Once: (replacer: AsyncableReplacer) => {
    const set = new Set<string>();
    return (str: string) => {
      if (set.has(str)) { return false; }
      set.add(str);
      return handleAsyncableReplacer(str, replacer);
    };
  },
} as const satisfies Record<string, (...args: any[]) => AsyncableReplacer>;

export class AhoCorasick extends AbstractStreamAhoCorasick<string, string> {
  constructor(keywords: string[]) {
    super(keywords);
  }

  public *matchInText(text: string): Iterable<Match> {
    const deque = new Deque<Match>();

    let confirmed_index = 0;
    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!state.can(ch)) { // use failure
        const old_depth = state.depth;
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
        const new_depth = state.depth;
        confirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
        while (!deque.empty()) {
          const first = deque.peekFirst()!;
          if (first.end > confirmed_index) { break; }
          yield deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) - length;
        const end = (i + 1);

        while (true) {
          if (deque.empty()) {
            deque.addLast({ begin, end, keyword });
            break;
          }

          const last = deque.peekLast()!;
          if (last.end <= begin) {
            deque.addLast({ begin, end, keyword });
            break;
          } else if (begin > last.begin) {
            break;
          } else {
            deque.pollLast();
          }
        }
      }
    }

    while (!deque.empty()) {
      yield deque.pollFirst()!;
    }
  }

  public *replaceSync(iterable: Iterable<string>, replacer: Replacer, boundary?: BoundaryFunc): Iterable<string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state: Trie = this.root;
    let confirmed_offset = 0;

    for (const text of iterable) {
      [state, confirmed_offset] = yield* this.processTextSync(state, deque, ring, text, confirmed_offset, collector, collect, detect, boundary);
    }
    yield* this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary);
  }

  public async *replaceAsync(iterable: AsyncIterable<string>, replacer: Replacer, boundary?: BoundaryFunc): AsyncIterable<string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state: Trie = this.root;
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, confirmed_offset] = yield* this.processTextSync(state, deque, ring, text, confirmed_offset, collector, collect, detect, boundary);
    }
    yield* this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary);
  }

  public async *replaceAsyncToMaybePromise(iterable: AsyncIterable<string>, replacer: AsyncableReplacer, boundary?: BoundaryFunc): AsyncIterable<string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state: Trie = this.root;
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, confirmed_offset] = yield* this.processTextAsync(state, deque, ring, text, confirmed_offset, collector, collect, detect, boundary);
    }
    yield* this.cleanupTextAsync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary);
  }
}

