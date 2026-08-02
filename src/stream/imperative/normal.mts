import Deque from "../deque.mts";
import type { BoundaryFunc } from "../base.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import RingBuffer from "../ringbuffer.mts";
import { AbstractStreamAhoCorasick, type Match } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryFunc, Match } from "../base.mts";

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

export class AhoCorasick extends AbstractStreamAhoCorasick {
  public replaceSync(replacer: Replacer, boundary?: BoundaryFunc): ImperativeHandle<string, string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<string, string> => {
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
      return confirmed ;
    };
    const end = (): ImperativeResult<string, string> => {
      return Array.from(this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary));
    };
    return ImperativeHandle.from<string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer, boundary?: BoundaryFunc): ImperativeHandle<string, string | Promise<string>> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<string, string | Promise<string>> => {
      const generator = this.processTextSync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
      const confirmed : (string | Promise<string>)[] = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, confirmed_offset] = value;
          break;
        }
        confirmed .push(value);
      }
      return confirmed ;
    };
    const end = (): (string | Promise<string>)[] => {
      return Array.from(this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary));
    };
    return ImperativeHandle.from<string, string | Promise<string>>(write, end);
  }

  public tokenizeSync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, boundary?: BoundaryFunc): ImperativeHandle<T, K> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<T, K> => {
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
      return confirmed ;
    };
    const end = (): ImperativeResult<T, K> => {
      return Array.from(this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary));
    };
    return ImperativeHandle.from<T, K>(write, end);
  }

  public tokenizeAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K | Promise<K>, boundary?: BoundaryFunc): ImperativeHandle<T, K | Promise<K>> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let confirmed_offset = 0;

    const write = (chunk: string): ImperativeResult<T, K | Promise<K>> => {
      const generator = this.processTextSync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
      const confirmed : ImperativeResult<T, K | Promise<K>> = []
      while (true) {
        const { value, done } = generator.next();
        if (done) {
          [state, confirmed_offset] = value;
          break;
        }
        confirmed .push(value);
      }
      return confirmed ;
    };
    const end = (): ImperativeResult<T, K | Promise<K>> => {
      return Array.from(this.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary));
    };
    return ImperativeHandle.from<T, K | Promise<K>>(write, end);
  }
}

