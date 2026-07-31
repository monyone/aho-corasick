import Collector from "../collector.mts";
import Deque from "../deque.mts";
import RingBuffer from "../ringbuffer.mts";
import { AhoCorasick as AhoCorasickBase } from "../stream.mts";
import type { Replacer, AsyncableReplacer, Match, BoundaryFunc } from "../stream.mts";

export { Replacer, AsyncableReplacer, Boundary } from "../stream.mts";
export type { BoundaryFunc } from "../stream.mts";

export class AhoCorasick extends AhoCorasickBase {

  public replaceStream(replacer: Replacer, boundary?: BoundaryFunc): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);

    let state = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      transform(chunk, controller) {
        const generator = aho.replaceProcessTextSync(state, deque, ring, chunk, confirmed_offset, collector, replacer, boundary);
        let result = generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = generator.next();
        }
        [state, confirmed_offset] = result.value;
      },
      flush(controller) {
        for (const chunk of aho.replaceCleanupTextSync(state, deque, ring, confirmed_offset, collector, replacer, boundary)) {
          controller.enqueue(chunk);
        }
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer, boundary?: BoundaryFunc): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);

    let state = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      async transform(chunk, controller) {
        const generator = aho.replaceProcessTextAsync(state, deque, ring, chunk, confirmed_offset, collector, replacer, boundary);
        let result = await generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = await generator.next();
        }
        [state, confirmed_offset] = result.value;
      },
      async flush(controller) {
        for await (const chunk of aho.replaceCleanupTextAsync(state, deque, ring, confirmed_offset, collector, replacer, boundary)) {
          controller.enqueue(chunk);
        }
      }
    });
  }
}

