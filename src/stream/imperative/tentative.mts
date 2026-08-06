import Deque from "../deque.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamTentativeAhoCorasick, STOP_TYPE, type Match } from "../base.mts";
import type { AsyncImperativeResult, ImperativeResult } from "./normal.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match } from "../base.mts";

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
  public replaceSync(replacer: Replacer): ImperativeWithTentativeHandle<string, string, string> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeWithTentativeResult<string, string, string> => {
      const generator = this.processTextSync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
      const confirmed : ImperativeResult<string, string> = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, prev, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return { confirmed , tentative: state.tentative! }
    };
    const end = (): ImperativeResult<string, string> => {
      return Array.from(this.cleanupTextSync(state, deque, prev, stop, confirmed_offset, collector, collect, detect));
    };
    return ImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer): AsyncImperativeWithTentativeHandle<string, string, string> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<string, string, string> => {
      const generator = this.processTextAsync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
      const confirmed : ImperativeResult<string, string> = []
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          [state, prev, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return { confirmed, tentative: state.tentative! }
    };
    const end = async (): AsyncImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = []
      for await (const chunk of this.cleanupTextAsync(state, deque, prev, stop, confirmed_offset, collector, collect, detect)) {
        confirmed.push(chunk);
      }
      return confirmed;
    };
    return AsyncImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public tokenizeSync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K, tentative: (tentative: string) => U): ImperativeWithTentativeHandle<T, K, U> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeWithTentativeResult<T, K, U> => {
      const generator = this.processTextSync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
      const confirmed : ImperativeResult<T, K> = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, prev, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return { confirmed , tentative: tentative(state.tentative!) }
    };
    const end = (): ImperativeResult<T, K> => {
      return Array.from(this.cleanupTextSync(state, deque, prev, stop, confirmed_offset, collector, collect, detect));
    };
    return ImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }

  public tokenizeAsync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, tentative: (tentative: string) => U): AsyncImperativeWithTentativeHandle<T, K, U> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<T, K, U> => {
      const generator = this.processTextAsync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
      const confirmed : ImperativeResult<T, K> = []
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          [state, prev, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return { confirmed , tentative: tentative(state.tentative!) }
    };
    const end = async (): AsyncImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = []
      for await (const chunk of this.cleanupTextAsync(state, deque, prev, stop, confirmed_offset, collector, collect, detect)) {
        confirmed.push(chunk);
      }
      return confirmed;
    };
    return AsyncImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }
}

