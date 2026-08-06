import { Transform } from "node:stream";

import Deque from "../deque.mts";
import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, STOP_TYPE, type Match, type StopFilter } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export { URLLikeStopFilter } from '../filter.mts'

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceStream(replacer: Replacer, stop?: StopFilter): Transform {
    const aho = this;
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, stop);
        let result = generator.next();
        while (!result.done) {
          this.push(result.value);
          result = generator.next();
        }
        [state, prev, stop_state, confirmed_offset] = result.value;
        cb();
      },
      flush(cb) {
        for (const chunk of aho.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, stop)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer, stop?: StopFilter): Transform {
    const aho = this;
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    return new Transform({
      decodeStrings: false,
      async transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }

        const generator = aho.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, collect, detect, stop);
        let result = await generator.next();
        while (!result.done) {
          this.push(result.value);
          result = await generator.next();
        }
        [state, prev, stop_state, confirmed_offset] = result.value;
        cb();
      },
      async flush(cb) {
        for await (const chunk of aho.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, collect, detect, stop)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }
}

