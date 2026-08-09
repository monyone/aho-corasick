import { type Replacer, type AsyncableReplacer, handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, type StopFilter } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export { URLLikeStopFilter } from '../filter.mts'

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceStream(replacer: Replacer, stop?: StopFilter): TransformStream<string, string> {
    const aho = this;
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    return new TransformStream<string, string>({
      transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = (chunk: string) => { controller.enqueue(handleReplacer(chunk, replacer)); }
        aho.processTextSync(session, chunk, collector, enqueueT, enqueueK, stop);
      },
      flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = (chunk: string) => { controller.enqueue(handleReplacer(chunk, replacer)); }
        aho.cleanupTextSync(session, collector, enqueueT, enqueueK, stop);
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer, stop?: StopFilter): TransformStream<string, string> {
    const aho = this;
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    return new TransformStream<string, string>({
      async transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await handleAsyncableReplacer(chunk, replacer)); }
        await aho.processTextAsync(session, chunk, collector, enqueueT, enqueueK, stop);
      },
      async flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(chunk); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await handleAsyncableReplacer(chunk, replacer)); }
        await aho.cleanupTextAsync(session, collector, enqueueT, enqueueK, stop)
      }
    });
  }

  public tokenizeStream<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K, stop?: StopFilter): TransformStream<string, T | K> {
    const aho = this;
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    return new TransformStream<string, T | K>({
      transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = (chunk: string) => { controller.enqueue(target(chunk)); }
        aho.processTextSync(session, chunk, collector, enqueueT, enqueueK, stop);
      },
      flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = (chunk: string) => { controller.enqueue(target(chunk)); }
        aho.cleanupTextSync(session, collector, enqueueT, enqueueK, stop);
      }
    });
  }

  public tokenizeStreamAsync<T, K>(normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, stop?: StopFilter): TransformStream<string, T | K> {
    const aho = this;
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    return new TransformStream<string, T | K>({
      async transform(chunk, controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await target(chunk)); }
        await aho.processTextAsync(session, chunk, collector, enqueueT, enqueueK, stop);
      },
      async flush(controller) {
        const enqueueT = (chunk: string) => { controller.enqueue(normal(chunk)); }
        const enqueueK = async (chunk: string) => { controller.enqueue(await target(chunk)); }
        await aho.cleanupTextAsync(session, collector, enqueueT, enqueueK, stop);
      }
    });
  }
}

