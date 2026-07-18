import { Transform } from "node:stream";

import Deque from "../deque.mts";
import { AhoCorasick as AhoCorasickBase } from "../stream.mts";
import type { Replacer, AsyncableReplacer, Match } from "../stream.mts";

export class AhoCorasick extends AhoCorasickBase {

  public replaceStream(replacer: Replacer): Transform {
    const aho = this;
    const deque = new Deque<Match>();

    let state = this.root;
    let remain_text = '';
    let remain_offset = 0;

    return new Transform({
      transform(chunk, _, cb) {
        remain_text += chunk;

        const generator = aho.replaceProcessTextSync(state, deque, remain_text, remain_offset, replacer);
        let result = generator.next();
        while (!result.done) {
          this.push(result.value);
          result = generator.next();
        }
        [state, remain_text] = result.value;
        remain_offset = remain_text.length;
        cb();
      },
      flush(cb) {
        for (const chunk of aho.replaceCleanupTextSync(deque, remain_text, replacer)) {
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
    let remain_text = '';
    let remain_offset = 0;

    return new Transform({
      async transform(chunk, _, cb) {
        remain_text += chunk;

        const generator = aho.replaceProcessTextAsync(state, deque, remain_text, remain_offset, replacer);
        let result = await generator.next();
        while (!result.done) {
          this.push(result.value);
          result = await generator.next();
        }
        [state, remain_text] = result.value;
        remain_offset = remain_text.length;
        cb();
      },
      async flush(cb) {
        for await (const chunk of aho.replaceCleanupTextAsync(deque, remain_text, replacer)) {
          this.push(chunk);
        }
        cb();
      }
    });
  }
}

