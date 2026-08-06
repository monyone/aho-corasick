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
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<string, string> => {
      const generator = this.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, stop);
      const confirmed : ImperativeResult<string, string> = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, prev, stop_state, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return confirmed;
    };
    const end = (): ImperativeResult<string, string> => {
      return Array.from(this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, stop));
    };
    return ImperativeHandle.from<string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer, stop?: StopFilter): AsyncImperativeHandle<string, string> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeResult<string, string> => {
      const generator = this.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, stop);
      const confirmed : ImperativeResult<string, string> = []
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          [state, prev, stop_state, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return confirmed;
    };
    const end = async (): AsyncImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = []
      for await (const chunk of this.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, stop)) {
        confirmed.push(chunk);
      }
      return confirmed;
    };
    return AsyncImperativeHandle.from<string, string>(write, end);
  }

  public tokenizeSync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): ImperativeHandle<T, K> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<T, K> => {
      const generator = this.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, stop);
      const confirmed : ImperativeResult<T, K> = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, prev, stop_state, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return confirmed;
    };
    const end = (): ImperativeResult<T, K> => {
      return Array.from(this.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, stop));
    };
    return ImperativeHandle.from<T, K>(write, end);
  }

  public tokenizeAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): AsyncImperativeHandle<T, K> {
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeResult<T, K> => {
      const generator = this.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, stop);
      const confirmed : ImperativeResult<T, K> = []
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          [state, prev, stop_state, confirmed_offset] = value;
          break;
        }
        confirmed.push(value);
      }
      return confirmed;
    };
    const end = async (): AsyncImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = []
      for await (const chunk of this.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, stop)) {
        confirmed.push(chunk);
      }
      return confirmed
    };
    return AsyncImperativeHandle.from<T, K>(write, end);
  }
}

