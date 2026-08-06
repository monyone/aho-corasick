import Deque from "../deque.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, STOP_TYPE, type Match, type StopFilter } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export { URLLikeStopFilter } from '../filter.mts'

export type ImperativeResult<T, K> = (T | K)[];
export type ImperativeHandle<T, K> = {
  write(chunk: string): ImperativeResult<T, K>;
  end(): ImperativeResult<T, K>;
};
export const ImperativeHandle = {
  from<T, K>(write: (chunk: string) => ImperativeResult<T, K>, end: () => ImperativeResult<T, K>): ImperativeHandle<T, K> {
    return { write, end };
  }
};

export type AsyncImperativeResult<T, K> = Promise<(T | K)[]>;
export type AsyncImperativeHandle<T, K> = {
  write(chunk: string): AsyncImperativeResult<T, K>;
  end(): AsyncImperativeResult<T, K>;
};
export const AsyncImperativeHandle = {
  from<T, K>(write: (chunk: string) => AsyncImperativeResult<T, K>, end: () => AsyncImperativeResult<T, K>): AsyncImperativeHandle<T, K> {
    return { write, end };
  }
};

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceSync(replacer: Replacer, stop?: StopFilter): ImperativeHandle<string, string> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = [];
      const pushT = (chunk: string) => { confirmed.push(chunk); }
      const pushK = (keyword: string) => { confirmed.push(handleReplacer(keyword, replacer)); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop);
      return confirmed;
    };
    const end = (): ImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = [];
      const pushT = (chunk: string) => { confirmed.push(chunk); }
      const pushK = (keyword: string) => { confirmed.push(handleReplacer(keyword, replacer)); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop);
      return confirmed;
    };
    return ImperativeHandle.from<string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer, stop?: StopFilter): AsyncImperativeHandle<string, string> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = [];
      const pushT = (chunk: string) => { confirmed.push(chunk); }
      const pushK = async (keyword: string) => { confirmed.push(await handleAsyncableReplacer(keyword, replacer)); }
      [state, prev, stop_state, confirmed_offset] =  await this.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop);
      return confirmed;
    };
    const end = async (): AsyncImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = [];
      const pushT = (chunk: string) => { confirmed.push(chunk); }
      const pushK = async (keyword: string) => { confirmed.push(await handleAsyncableReplacer(keyword, replacer)); }
      await this.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop)
      return confirmed;
    };
    return AsyncImperativeHandle.from<string, string>(write, end);
  }

  public tokenizeSync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): ImperativeHandle<T, K> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunk: string) => { confirmed.push(normal(chunk)); }
      const pushK = (keyword: string) => { confirmed.push(target(keyword)); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop);
      return confirmed;
    };
    const end = (): ImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunk: string) => { confirmed.push(normal(chunk)); }
      const pushK = (keyword: string) => { confirmed.push(target(keyword)); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop);
      return confirmed;
    };
    return ImperativeHandle.from<T, K>(write, end);
  }

  public tokenizeAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, stop?: StopFilter): AsyncImperativeHandle<T, K> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunk: string) => { confirmed.push(normal(chunk)); }
      const pushK = async (keyword: string) => { confirmed.push(await target(keyword)); }
      [state, prev, stop_state, confirmed_offset] = await this.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop);
      return confirmed;
    };
    const end = async (): AsyncImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunk: string) => { confirmed.push(normal(chunk)); }
      const pushK = async (keyword: string) => { confirmed.push(await target(keyword)); }
      await this.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, pushT, pushK, stop);
      return confirmed
    };
    return AsyncImperativeHandle.from<T, K>(write, end);
  }
}

