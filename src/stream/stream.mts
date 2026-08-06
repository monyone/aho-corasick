import { AbstractStreamGeneralAhoCorasick, isPromiseLike, type StopFilter } from "./base.mts";
import Collector from "./collector.mts";
import Deque from "./deque.mts";
import { STOP_TYPE, type Match } from "./base.mts";

type ReplaceFunc = ((detect: string) => (string | false));
type AsyncableReplaceFunc = ((detect: string) => PromiseLike<ReturnType<ReplaceFunc>> | ReturnType<ReplaceFunc>);
export type Replacer = Record<string, string> | Map<string, string> | ReplaceFunc;
export type AsyncableReplacer = Replacer | AsyncableReplaceFunc;
export { Boundary } from './base.mts';
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from './base.mts';
export { URLLikeStopFilter } from './filter.mts'

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

export const handleAsyncableReplacer = (detect: string, replacer: AsyncableReplacer): string | PromiseLike<string> => {
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
    if (isPromiseLike<ReturnType<ReplaceFunc>>(replaced)) {
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

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public *replaceSync(iterable: Iterable<string>, replacer: Replacer, stop?: StopFilter): Iterable<string> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    for (const text of iterable) {
      const output: string[] = [];
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: string) => { output.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, text, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
    {
      const output: string[] = [];
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: string) => { output.push(chunk); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
  }

  public async *replaceAsync(iterable: AsyncIterable<string>, replacer: Replacer, stop?: StopFilter): AsyncIterable<string> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    for await (const text of iterable) {
      const output: string[] = [];
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: string) => { output.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, text, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
    {
      const output: string[] = [];
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: string) => { output.push(chunk); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
  }

  public *tokenizeSync<T, K>(iterable: Iterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): Iterable<T | K> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    for (const text of iterable) {
      const output: (T | K)[] = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: K) => { output.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, text, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
    {
      const output: (T | K)[] = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: K) => { output.push(chunk); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
  }

  public async *tokenizeAsync<T, K>(iterable: AsyncIterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): AsyncIterable<T | K> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    for await (const text of iterable) {
      const output: (T | K)[] = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: K) => { output.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, text, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
    {
      const output: (T | K)[] = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { output.push(chunk); }
      }
      const pushK = (chunk: K) => { output.push(chunk); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      yield* output;
    }
  }
}

