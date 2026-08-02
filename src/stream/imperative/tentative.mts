import Deque from "../deque.mts";
import type { BoundaryFunc } from "../base.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import RingBuffer from "../ringbuffer.mts";
import { AbstractStreamTentativeAhoCorasick, type Match } from "../base.mts";
import type { AsyncImperativeResult, ImperativeResult } from "./normal.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryFunc, Match } from "../base.mts";

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
  public replaceSync(replacer: Replacer, boundary?: BoundaryFunc): ImperativeWithTentativeHandle<string, string, string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeWithTentativeResult<string, string, string> => {
      const generator = this.processTextSync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
      const confirmed : ImperativeResult<string, string> = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, confirmed_offset] = value;
          break;
        }
        confirmed .push(value);
      }
      return { confirmed , tentative: this.tentative.get(state)! }
    };
    const end = (): ImperativeResult<string, string> => {
      return Array.from(this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary));
    };
    return ImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer, boundary?: BoundaryFunc): AsyncImperativeWithTentativeHandle<string, string, string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<string, string, string> => {
      const generator = this.processTextAsync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
      const confirmed : ImperativeResult<string, string> = []
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          [state, confirmed_offset] = value;
          break;
        }
        confirmed .push(value);
      }
      return { confirmed, tentative: this.tentative.get(state)! }
    };
    const end = async (): AsyncImperativeResult<string, string> => {
      const confirmed : ImperativeResult<string, string> = []
      for await (const chunk of this.cleanupTextAsync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
        confirmed.push(chunk);
      }
      return confirmed
    };
    return AsyncImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public tokenizeSync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K, tentative: (tentative: string) => U, boundary?: BoundaryFunc): ImperativeWithTentativeHandle<T, K, U> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeWithTentativeResult<T, K, U> => {
      const generator = this.processTextSync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
      const confirmed : ImperativeResult<T, K> = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, confirmed_offset] = value;
          break;
        }
        confirmed .push(value);
      }
      return { confirmed , tentative: tentative(this.tentative.get(state)!) }
    };
    const end = (): ImperativeResult<T, K> => {
      return Array.from(this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary));
    };
    return ImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }

  public tokenizeAsync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K | Promise<K>, tentative: (tentative: string) => U, boundary?: BoundaryFunc): AsyncImperativeWithTentativeHandle<T, K, U> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let confirmed_offset = 0;

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<T, K, U> => {
      const generator = this.processTextAsync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
      const confirmed : ImperativeResult<T, K> = []
      while (true) {
        const { value, done } = await generator.next();
        if (done) {
          [state, confirmed_offset] = value;
          break;
        }
        confirmed .push(value);
      }
      return { confirmed , tentative: tentative(this.tentative.get(state)!) }
    };
    const end = async (): AsyncImperativeResult<T, K> => {
      const confirmed : ImperativeResult<T, K> = []
      for await (const chunk of this.cleanupTextAsync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
        confirmed.push(chunk);
      }
      return confirmed
    };
    return AsyncImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }
}

