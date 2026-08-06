import Deque from "../deque.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamTentativeAhoCorasick, STOP_TYPE, type Match, type StopFilter } from "../base.mts";
import type { AsyncImperativeResult, ImperativeResult } from "./normal.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export { URLLikeStopFilter } from '../filter.mts'

export type ImperativeWithTentativeResult<T, K, U> = {
  confirmed : ImperativeResult<T, K>;
  tentative: U;
};
export type ImperativeWithTentativeHandle<T, K, U> = {
  write(chunk: string): ImperativeWithTentativeResult<T, K, U>;
  end(): ImperativeResult<T, K>;
};
const ImperativeWithTentativeHandle = {
  from<T, K, U>(write: (chunk: string) => ImperativeWithTentativeResult<T, K, U>, end: () => ImperativeResult<T, K>): ImperativeWithTentativeHandle<T, K, U> {
    return { write, end };
  }
}

export type AsyncImperativeWithTentativeResult<T, K, U> = Promise<{
  confirmed : ImperativeResult<T, K>;
  tentative: U;
}>;
export type AsyncImperativeWithTentativeHandle<T, K, U> = {
  write(chunk: string): AsyncImperativeWithTentativeResult<T, K, U>;
  end(): AsyncImperativeResult<T, K>;
};
const AsyncImperativeWithTentativeHandle = {
  from<T, K, U>(write: (chunk: string) => AsyncImperativeWithTentativeResult<T, K, U>, end: () => AsyncImperativeResult<T, K>): AsyncImperativeWithTentativeHandle<T, K, U> {
    return { write, end };
  }
};

export class AhoCorasick extends AbstractStreamTentativeAhoCorasick {
  public replaceSync(replacer: Replacer, stop?: StopFilter): ImperativeWithTentativeHandle<string, string, string> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeWithTentativeResult<string, string, string> => {
      const confirmed : ImperativeResult<string, string> = [];
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: string) => { confirmed.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return { confirmed , tentative: state.tentative! }
    };
    const end = (): ImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = [];
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: string) => { confirmed.push(chunk); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return confirmed;
    };
    return ImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer, stop?: StopFilter): AsyncImperativeWithTentativeHandle<string, string, string> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<string, string, string> => {
      const confirmed : ImperativeResult<string, string> = []
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: string) => { confirmed.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = await this.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return { confirmed, tentative: state.tentative! }
    };
    const end = async (): AsyncImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = [];
      const pushT = (chunks: Iterable<string>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: string) => { confirmed.push(chunk); }
      await this.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return confirmed;
    };
    return AsyncImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public tokenizeSync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K, tentative: (tentative: string) => U, stop?: StopFilter): ImperativeWithTentativeHandle<T, K, U> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeWithTentativeResult<T, K, U> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: K) => { confirmed.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = this.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return { confirmed , tentative: tentative(state.tentative!) }
    };
    const end = (): ImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: K) => { confirmed.push(chunk); }
      this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return confirmed;
    };
    return ImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }

  public tokenizeAsync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, tentative: (tentative: string) => U, stop?: StopFilter): AsyncImperativeWithTentativeHandle<T, K, U> {
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<T, K, U> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: K) => { confirmed.push(chunk); }
      [state, prev, stop_state, confirmed_offset] = await this.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return { confirmed , tentative: tentative(state.tentative!) }
    };
    const end = async (): AsyncImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = [];
      const pushT = (chunks: Iterable<T>) => {
        for (const chunk of chunks) { confirmed.push(chunk); }
      }
      const pushK = (chunk: K) => { confirmed.push(chunk); }
      await this.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, pushT, pushK, stop);
      return confirmed;
    };
    return AsyncImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }
}

