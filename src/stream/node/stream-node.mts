import { Transform } from "node:stream";

import Deque from "../deque.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, type Match } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match } from "../base.mts";

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceStream(replacer: Replacer): Transform {
    const aho = this;
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop: boolean = false;
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.processTextSync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
        let result = generator.next();
        while (!result.done) {
          this.push(result.value);
          result = generator.next();
        }
        [state, prev, confirmed_offset] = result.value;
        cb();
      },
      flush(cb) {
        for (const chunk of aho.cleanupTextSync(state, deque, prev, confirmed_offset, collector, collect, detect)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer): Transform {
    const aho = this;
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop: boolean = false;
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      async transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.processTextAsync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
        let result = await generator.next();
        while (!result.done) {
          this.push(result.value);
          result = await generator.next();
        }
        [state, prev, confirmed_offset] = result.value;
        cb();
      },
      async flush(cb) {
        for await (const chunk of aho.cleanupTextAsync(state, deque, prev, confirmed_offset, collector, collect, detect)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }
}

