import { Transform } from "node:stream";

import Deque from "../deque.mts";
import { AhoCorasick as AhoCorasickBase } from "../stream.mts";
import type { Replacer, AsyncableReplacer, Match } from "../stream.mts";
import Collector from "../collector.mts";

export class AhoCorasick extends AhoCorasickBase {

  public replaceStream(replacer: Replacer): Transform {
    const aho = this;
    const deque = new Deque<Match>();

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

        const generator = aho.replaceProcessTextSync(state, deque, chunk, confirmed_offset, collector, replacer);
        let result = generator.next();
        while (!result.done) {
          this.push(result.value);
          result = generator.next();
        }
        [state, confirmed_offset] = result.value;
        cb();
      },
      flush(cb) {
        for (const chunk of aho.replaceCleanupTextSync(deque, confirmed_offset, collector, replacer)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer): Transform {
    const aho = this;
    const deque = new Deque<Match>();

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

        const generator = aho.replaceProcessTextAsync(state, deque, chunk, confirmed_offset, collector, replacer);
        let result = await generator.next();
        while (!result.done) {
          this.push(result.value);
          result = await generator.next();
        }
        [state, confirmed_offset] = result.value;
        cb();
      },
      async flush(cb) {
        for await (const chunk of aho.replaceCleanupTextAsync(deque, confirmed_offset, collector, replacer)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }
}

