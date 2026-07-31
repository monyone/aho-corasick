import Deque from "../deque.mts";
import type { BoundaryFunc } from "../base.mts";
import { type Replacer, type AsyncableReplacer, handleAsyncableReplacer, handleReplacer } from "../replace.mts";
import Collector from "../collector.mts";
import RingBuffer from "../ringbuffer.mts";
import { AbstractStreamAhoCorasick, type Match } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../replace.mts";
export { Boundary } from "../base.mts";
export type { BoundaryFunc, Match } from "../base.mts";

export class AhoCorasick extends AbstractStreamAhoCorasick<string, string> {

  public replaceStream(replacer: Replacer, boundary?: BoundaryFunc): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
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
        for (const chunk of aho.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
          controller.enqueue(chunk);
        }
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer, boundary?: BoundaryFunc): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
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
        for await (const chunk of aho.cleanupTextAsync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
          controller.enqueue(chunk);
        }
      }
    });
  }
}

