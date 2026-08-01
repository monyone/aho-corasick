import Deque from "../deque.mts";
import type { BoundaryFunc } from "../base.mts";
import Collector from "../collector.mts";
import RingBuffer from "../ringbuffer.mts";
import { AbstractStreamAhoCorasick, type Match } from "../base.mts";

export { Boundary } from "../base.mts";
export type { BoundaryFunc, Match } from "../base.mts";

export class AhoCorasick extends AbstractStreamAhoCorasick {

  public tokenizeStream<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, boundary?: BoundaryFunc): TransformStream<string, T | K> {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let confirmed_offset = 0;

    return new TransformStream<string, T | K>({
      transform(chunk, controller) {
        const generator = aho.processTextSync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
        let result = generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = generator.next();
        }
        [state, confirmed_offset] = result.value;
      },
      flush(controller) {
        for (const token of aho.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
          controller.enqueue(token);
        }
      }
    });
  }

  public tokenizeStreamAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K | Promise<K>, boundary?: BoundaryFunc): TransformStream<string, T | K> {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let confirmed_offset = 0;

    return new TransformStream<string, T | K>({
      async transform(chunk, controller) {
        const generator = aho.processTextAsync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
        let result = await generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = await generator.next();
        }
        [state, confirmed_offset] = result.value;
      },
      async flush(controller) {
        for await (const token of aho.cleanupTextAsync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
          controller.enqueue(token);
        }
      }
    });
  }
}

