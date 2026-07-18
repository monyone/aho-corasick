import Deque from "../deque.mts";
import { AhoCorasick as AhoCorasickBase } from "../stream.mts";
import type { Replacer, AsyncableReplacer, Match } from "../stream.mts";

export class AhoCorasick extends AhoCorasickBase {

  public replaceStream(replacer: Replacer): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    let deque_offset = 0;

    let state = this.root;
    let remain_text = '';
    let remain_offset = 0;

    return new TransformStream<string, string>({
      transform(chunk, controller) {
        remain_text += chunk;

        const generator = aho.replaceProcessTextSync(state, deque, deque_offset, remain_text, remain_offset, replacer);
        let result = generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = generator.next();
        }
        [state, deque_offset, remain_text] = result.value;
        remain_offset = remain_text.length;
        deque_offset = aho.maintainOffset(deque, deque_offset);
      },
      flush(controller) {
        for (const chunk of aho.replaceCleanupTextSync(deque, deque_offset, remain_text, replacer)) {
          controller.enqueue(chunk);
        }
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    let deque_offset = 0;

    let state = this.root;
    let remain_text = '';
    let remain_offset = 0;

    return new TransformStream<string, string>({
      async transform(chunk, controller) {
        remain_text += chunk;

        const generator = aho.replaceProcessTextAsync(state, deque, deque_offset, remain_text, remain_offset, replacer);
        let result = await generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = await generator.next();
        }
        [state, deque_offset, remain_text] = result.value;
        remain_offset = remain_text.length;
        deque_offset = aho.maintainOffset(deque, deque_offset);
      },
      async flush(controller) {
        for await (const chunk of aho.replaceCleanupTextAsync(deque, deque_offset, remain_text, replacer)) {
          controller.enqueue(chunk);
        }
      }
    });
  }
}

