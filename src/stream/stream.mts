import { AbstractStreamGeneralAhoCorasick, isPromiseLike, type StopFilter } from "./base.mts";
import Collector from "./collector.mts";
import { AsyncableStringBuffer, StringBuffer } from "./stringbuffer.mts";

type ReplaceFunc = ((detect: string) => (string | false));
type AsyncableReplaceFunc = ((detect: string) => PromiseLike<ReturnType<ReplaceFunc>> | ReturnType<ReplaceFunc>);
export type Replacer = Record<string, string> | Map<string, string> | ReplaceFunc;
export type AsyncableReplacer = Replacer | AsyncableReplaceFunc;
export { Boundary } from './base.mts';
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from './base.mts';
export * from './filter/index.mts'

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
} as const satisfies Record<string, (...args: never[]) => Replacer>;

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
} as const satisfies Record<string, (...args: never[]) => AsyncableReplacer>;

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public *iterableReplaceSync(iterable: Iterable<string>, replacer: Replacer, stop?: StopFilter): Iterable<string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = (keyword: string) => handleReplacer(keyword, replacer);

    for (const text of iterable) {
      const output = new StringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      this.processTextSync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new StringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  public async *iterableReplaceAsync(iterable: Iterable<string>, replacer: AsyncableReplacer, stop?: StopFilter): AsyncIterable<string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = async (keyword: string) => await handleAsyncableReplacer(keyword, replacer);

    for (const text of iterable) {
      const output = new AsyncableStringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      await this.processTextAsync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new AsyncableStringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  public async *asyncIterableReplaceSync(iterable: AsyncIterable<string>, replacer: Replacer, stop?: StopFilter): AsyncIterable<string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = (keyword: string) => handleReplacer(keyword, replacer);

    for await (const text of iterable) {
      const output = new StringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      this.processTextSync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new StringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  public async *asyncIterableReplaceAsync(iterable: AsyncIterable<string>, replacer: AsyncableReplacer, stop?: StopFilter): AsyncIterable<string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = async (keyword: string) => await handleAsyncableReplacer(keyword, replacer);

    for await (const text of iterable) {
      const output = new AsyncableStringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      await this.processTextAsync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new AsyncableStringBuffer<string, string>();
      const pushT = output.push.bind(output, identity);
      const pushK = output.push.bind(output, replace);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  public *iterableTokenizeSync<T, K>(iterable: Iterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): Iterable<T | K> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    for (const text of iterable) {
      const output = new StringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      this.processTextSync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new StringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  public async *iterableTokenizeAsync<T, K>(iterable: Iterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, stop?: StopFilter): AsyncIterable<T | K> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    for (const text of iterable) {
      const output = new AsyncableStringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      await this.processTextAsync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new AsyncableStringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  public async *asyncIterableTokenizeSync<T, K>(iterable: AsyncIterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): AsyncIterable<T | K> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    for await (const text of iterable) {
      const output = new StringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      this.processTextSync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new StringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  public async *asyncIterableTokenizeAsync<T, K>(iterable: AsyncIterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, stop?: StopFilter): AsyncIterable<T | K> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    for await (const text of iterable) {
      const output = new AsyncableStringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      await this.processTextAsync(session, text, collector, pushT, pushK, stop);
      yield* output.data();
    }
    {
      const output = new AsyncableStringBuffer<T, K>();
      const pushT = output.push.bind(output, normal);
      const pushK = output.push.bind(output, target);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop);
      yield* output.data();
    }
  }

  /** @deprecated */
  public replaceSync(iterable: Iterable<string>, replacer: Replacer, stop?: StopFilter): Iterable<string> {
    return this.iterableReplaceSync(iterable, replacer, stop);
  }

  /** @deprecated */
  public replaceAsync(iterable: AsyncIterable<string>, replacer: Replacer, stop?: StopFilter): AsyncIterable<string> {
    return this.asyncIterableReplaceSync(iterable, replacer, stop);
  }

  /** @deprecated */
  public tokenizeSync<T, K>(iterable: Iterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): Iterable<T | K> {
    return this.iterableTokenizeSync(iterable, normal, target, stop);
  }

  /** @deprecated */
  public tokenizeAsync<T, K>(iterable: AsyncIterable<string>, normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): AsyncIterable<T | K> {
    return this.asyncIterableTokenizeSync(iterable, normal, target, stop);
  }
}
