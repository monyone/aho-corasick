import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, type StopFilter } from "../base.mts";
import { AsyncableStringBuffer, StringBuffer } from "../stringbuffer.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export * from '../filter/index.mts'

export type ImperativeResult<T, K> = (T | K)[];
export type ImperativeHandle<T, K> = {
  write(chunk: string): ImperativeResult<T, K>;
  end(): ImperativeResult<T, K>;
};
const ImperativeHandle = {
  from<T, K>(write: (chunk: string) => ImperativeResult<T, K>, end: () => ImperativeResult<T, K>): ImperativeHandle<T, K> {
    return { write, end };
  }
};

export type AsyncImperativeResult<T, K> = Promise<(T | K)[]>;
export type AsyncImperativeHandle<T, K> = {
  write(chunk: string): AsyncImperativeResult<T, K>;
  end(): AsyncImperativeResult<T, K>;
};
const AsyncImperativeHandle = {
  from<T, K>(write: (chunk: string) => AsyncImperativeResult<T, K>, end: () => AsyncImperativeResult<T, K>): AsyncImperativeHandle<T, K> {
    return { write, end };
  }
};

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceSync(replacer: Replacer, stop?: StopFilter): ImperativeHandle<string, string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = (keyword: string) => handleReplacer(keyword, replacer);

    const write = (chunk: string): ImperativeResult<string, string> => {
      const confirmed = new StringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      this.processTextSync(session, chunk, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    const end = (): ImperativeResult<string, string> => {
      const confirmed = new StringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return ImperativeHandle.from<string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer, stop?: StopFilter): AsyncImperativeHandle<string, string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = async (keyword: string) => await handleAsyncableReplacer(keyword, replacer);

    const write = async (chunk: string): AsyncImperativeResult<string, string> => {
      const confirmed = new AsyncableStringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      await this.processTextAsync(session, chunk, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    const end = async (): AsyncImperativeResult<string, string> => {
      const confirmed = new AsyncableStringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop)
      return confirmed.data();
    };
    return AsyncImperativeHandle.from<string, string>(write, end);
  }

  public tokenizeSync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): ImperativeHandle<T, K> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    const write = (chunk: string): ImperativeResult<T, K> => {
      const confirmed = new StringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      this.processTextSync(session, chunk, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    const end = (): ImperativeResult<T, K> => {
      const confirmed = new StringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return ImperativeHandle.from<T, K>(write, end);
  }

  public tokenizeAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, stop?: StopFilter): AsyncImperativeHandle<T, K> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    const write = async (chunk: string): AsyncImperativeResult<T, K> => {
      const confirmed = new AsyncableStringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      await this.processTextAsync(session, chunk, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    const end = async (): AsyncImperativeResult<T, K> => {
      const confirmed = new AsyncableStringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return AsyncImperativeHandle.from<T, K>(write, end);
  }
}

