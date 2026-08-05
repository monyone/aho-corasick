import Deque from "../deque.mts";
import { type Replacer, type AsyncableReplacer, handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, type Match } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match } from "../base.mts";

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceStream(replacer: Replacer): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop: boolean = false;
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      transform(chunk, controller) {
        const generator = aho.processTextSync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
        let result = generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = generator.next();
        }
        [state, prev, confirmed_offset] = result.value;
      },
      flush(controller) {
        for (const chunk of aho.cleanupTextSync(state, deque, prev, confirmed_offset, collector, collect, detect)) {
          controller.enqueue(chunk);
        }
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => collector.take(end - begin);
    const detect = (keyword: string) => handleAsyncableReplacer(keyword, replacer);

    let state = this.root;
    let prev: string | null = null;
    let stop: boolean = false;
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      async transform(chunk, controller) {
        const generator = aho.processTextAsync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
        let result = await generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = await generator.next();
        }
        [state, prev, confirmed_offset] = result.value;
      },
      async flush(controller) {
        for await (const chunk of aho.cleanupTextAsync(state, deque, prev, confirmed_offset, collector, collect, detect)) {
          controller.enqueue(chunk);
        }
      }
    });
  }

  public tokenizeStream<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K): TransformStream<string, T | K> {
    const aho = this;
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop: boolean = false;
    let confirmed_offset = 0;

    return new TransformStream<string, T | K>({
      transform(chunk, controller) {
        const generator = aho.processTextSync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
        let result = generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = generator.next();
        }
        [state, prev, confirmed_offset] = result.value;
      },
      flush(controller) {
        for (const token of aho.cleanupTextSync(state, deque, prev, confirmed_offset, collector, collect, detect)) {
          controller.enqueue(token);
        }
      }
    });
  }

  public tokenizeStreamAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K | Promise<K>): TransformStream<string, T | K> {
    const aho = this;
    const deque = new Deque<Match>();
    const collector = new Collector();
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop: boolean = false;
    let confirmed_offset = 0;

    return new TransformStream<string, T | K>({
      async transform(chunk, controller) {
        const generator = aho.processTextAsync(state, deque, chunk, prev, stop, confirmed_offset, collector, collect, detect);
        let result = await generator.next();
        while (!result.done) {
          controller.enqueue(result.value);
          result = await generator.next();
        }
        [state, prev, confirmed_offset] = result.value;
      },
      async flush(controller) {
        for await (const token of aho.cleanupTextAsync(state, deque, prev, confirmed_offset, collector, collect, detect)) {
          controller.enqueue(token);
        }
      }
    });
  }
}

