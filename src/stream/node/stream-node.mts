import { Transform } from "node:stream";

import Deque from "../deque.mts";
import { AhoCorasick as AhoCorasickBase } from "../stream.mts";
import type { Replacer, AsyncableReplacer, Match, BoundaryFunc } from "../stream.mts";
import Collector from "../collector.mts";
import RingBuffer from "../ringbuffer.mts";

export { Replacer, AsyncableReplacer, Boundary } from "../stream.mts";
export type { BoundaryFunc } from "../stream.mts";

export class AhoCorasick extends AhoCorasickBase {

  public replaceStream(replacer: Replacer, boundary?: BoundaryFunc): Transform {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);

    let state = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.replaceProcessTextSync(state, deque, ring, chunk, confirmed_offset, collector, replacer, boundary);
        let result = generator.next();
        while (!result.done) {
          this.push(result.value);
          result = generator.next();
        }
        [state, confirmed_offset] = result.value;
        cb();
      },
      flush(cb) {
        for (const chunk of aho.replaceCleanupTextSync(state, deque, ring, confirmed_offset, collector, replacer, boundary)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer, boundary?: BoundaryFunc): Transform {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);

    let state = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      async transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.replaceProcessTextAsync(state, deque, ring, chunk, confirmed_offset, collector, replacer, boundary);
        let result = await generator.next();
        while (!result.done) {
          this.push(result.value);
          result = await generator.next();
        }
        [state, confirmed_offset] = result.value;
        cb();
      },
      async flush(cb) {
        for await (const chunk of aho.replaceCleanupTextAsync(state, deque, ring, confirmed_offset, collector, replacer, boundary)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }
}

