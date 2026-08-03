import { AbstractStreamAhoCorasick, Trie } from "./base.mts";
import Collector from "./collector.mts";
import Deque from "./deque.mts";
import type { Match } from "./base.mts";

type ReplaceFunc = ((detect: string) => (string | false));
type AsyncableReplaceFunc = ((detect: string) => Promise<ReturnType<ReplaceFunc>> | ReturnType<ReplaceFunc>);
export type Replacer = Record<string, string> | Map<string, string> | ReplaceFunc;
export type AsyncableReplacer = Replacer | AsyncableReplaceFunc;
export { Boundary } from './base.mts';
export type { BoundaryFunc, Match } from './base.mts';

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

export class AhoCorasick extends AbstractStreamAhoCorasick {
  public *replaceSync(iterable: Iterable<string>, replacer: Replacer): Iterable<string> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let confirmed_offset = 0;

    for (const text of iterable) {
      [state, prev, confirmed_offset] = yield* this.processTextSync(state, deque, text, prev, confirmed_offset, collector, collect, detect);
    }
    yield* this.cleanupTextSync(state, deque, confirmed_offset, collector, collect, detect);
  }

  public async *replaceAsync(iterable: AsyncIterable<string>, replacer: Replacer): AsyncIterable<string> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, prev, confirmed_offset] = yield* this.processTextSync(state, deque, text, prev, confirmed_offset, collector, collect, detect);
    }
    yield* this.cleanupTextSync(state, deque, confirmed_offset, collector, collect, detect);
  }

  public *tokenizeSync<T, K>(iterable: Iterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K): Iterable<T | K> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let confirmed_offset = 0;

    for (const text of iterable) {
      [state, prev, confirmed_offset] = yield* this.processTextSync(state, deque, text, prev, confirmed_offset, collector, collect, detect);
    }
    yield* this.cleanupTextSync(state, deque, confirmed_offset, collector, collect, detect);
  }

  public async *tokenizeAsync<T, K>(iterable: AsyncIterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K): AsyncIterable<T | K> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, prev, confirmed_offset] = yield* this.processTextSync(state, deque, text, prev, confirmed_offset, collector, collect, detect);
    }
    yield* this.cleanupTextSync(state, deque, confirmed_offset, collector, collect, detect);
  }
}

