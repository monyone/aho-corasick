import Deque from "../deque.mts";
import { type Replacer, type AsyncableReplacer, handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, STOP_TYPE, type Match, type StopFilter } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export { URLLikeStopFilter } from '../filter.mts'

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceStream(replacer: Replacer, stop?: StopFilter): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = (chunk: string) => { controller.enqueue(handleReplacer(chunk, replacer)); }
        [state, prev, stop_state, confirmed_offset] = aho.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop);
      },
      flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = (chunk: string) => { controller.enqueue(handleReplacer(chunk, replacer)); }
        aho.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop);
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer, stop?: StopFilter): TransformStream<string, string> {
    const aho = this;
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    return new TransformStream<string, string>({
      async transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await handleAsyncableReplacer(chunk, replacer)); }
        [state, prev, stop_state, confirmed_offset] = await aho.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop);
      },
      async flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await handleAsyncableReplacer(chunk, replacer)); }
        await aho.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop)
      }
    });
  }

  public tokenizeStream<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): TransformStream<string, T | K> {
    const aho = this;
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const collect = (begin: number, end: number) => Array.from(collector.take(end - begin), normal);
    const detect = (keyword: string) => target(keyword);

    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    return new TransformStream<string, T | K>({
      transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = (chunk: string) => { controller.enqueue(target(chunk)); }
        [state, prev, stop_state, confirmed_offset] = aho.processTextSync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop);
      },
      flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = (chunk: string) => { controller.enqueue(target(chunk)); }
        aho.cleanupTextSync(state, deque, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop);
      }
    });
  }

  public tokenizeStreamAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, stop?: StopFilter): TransformStream<string, T | K> {
    const aho = this;
    const deque = new Deque<Match>(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    let state = this.root;
    let prev: string | null = null;
    let stop_state: STOP_TYPE = STOP_TYPE.NONE;
    let confirmed_offset = 0;

    return new TransformStream<string, T | K>({
      async transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await target(chunk)); }
        [state, prev, stop_state, confirmed_offset] = await aho.processTextAsync(state, deque, chunk, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop);
      },
      async flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await target(chunk)); }
        await aho.cleanupTextAsync(state, deque, prev, stop_state, confirmed_offset, collector, enqueueT, enqueueK, stop);
      }
    });
  }
}

