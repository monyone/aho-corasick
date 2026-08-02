import { Transform } from "node:stream";

import Deque from "../deque.mts";
import type { BoundaryFunc } from "../base.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import RingBuffer from "../ringbuffer.mts";
import { AbstractStreamAhoCorasick, type Match } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryFunc, Match } from "../base.mts";

export class AhoCorasick extends AbstractStreamAhoCorasick {

  public replaceStream(replacer: Replacer, boundary?: BoundaryFunc): Transform {
    const aho = this;
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.processTextSync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
        let result = generator.next();
        while (!result.done) {
          this.push(result.value);
          result = generator.next();
        }
        [state, confirmed_offset] = result.value;
        cb();
      },
      flush(cb) {
        for (const chunk of aho.cleanupTextSync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
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
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      async transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.processTextAsync(state, deque, ring, chunk, confirmed_offset, collector, collect, detect, boundary);
        let result = await generator.next();
        while (!result.done) {
          this.push(result.value);
          result = await generator.next();
        }
        [state, confirmed_offset] = result.value;
        cb();
      },
      async flush(cb) {
        for await (const chunk of aho.cleanupTextAsync(state, deque, ring, confirmed_offset, collector, collect, detect, boundary)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }
}

