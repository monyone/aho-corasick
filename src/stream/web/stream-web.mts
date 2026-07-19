import Deque from "../deque.mts";
import { AhoCorasick as AhoCorasickBase } from "../stream.mts";
import type { Replacer, AsyncableReplacer, Match } from "../stream.mts";

export class AhoCorasick extends AhoCorasickBase {

  public replaceStream(replacer: Replacer): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();

    let state = this.root;
    let remain_text = '';
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      transform(chunk, controller) {
        const generator = aho.replaceProcessTextSync(state, deque, chunk, confirmed_offset, remain_text, replacer);
        let result = generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = generator.next();
        }
        [state, confirmed_offset, remain_text] = result.value;
      },
      flush(controller) {
        for (const chunk of aho.replaceCleanupTextSync(deque, confirmed_offset, remain_text, replacer)) {
          controller.enqueue(chunk);
        }
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();

    let state = this.root;
    let remain_text = '';
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      async transform(chunk, controller) {
        const generator = aho.replaceProcessTextAsync(state, deque, chunk, confirmed_offset, remain_text, replacer);
        let result = await generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = await generator.next();
        }
        [state, confirmed_offset, remain_text] = result.value;
      },
      async flush(controller) {
        for await (const chunk of aho.replaceCleanupTextAsync(deque, confirmed_offset, remain_text, replacer)) {
          controller.enqueue(chunk);
        }
      }
    });
  }
}

