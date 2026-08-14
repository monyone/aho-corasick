import { Transform } from "node:stream";

import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamGeneralAhoCorasick, type StopFilter } from "../base.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export * from '../filter/index.mts'

export class AhoCorasick extends AbstractStreamGeneralAhoCorasick {
  public replaceStream(replacer: Replacer, stop?: StopFilter): Transform {
    const aho = this;
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    return new Transform({
      decodeStrings: false,
      transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }
        const pushT = (chunk: string) => { this.push(chunk); }
        const pushK = (chunk: string) => { this.push(handleReplacer(chunk, replacer)); }
        aho.processTextSync(session, chunk, collector, pushT, pushK, stop);
        cb();
      },
      flush(cb) {
        const pushT = (chunk: string) => { this.push(chunk); }
        const pushK = (chunk: string) => { this.push(handleReplacer(chunk, replacer)); }
        aho.cleanupTextSync(session, collector, pushT, pushK, stop);
        cb();
      }
    });
  }

  public replaceStreamAsync(replacer: AsyncableReplacer, stop?: StopFilter): Transform {
    const aho = this;
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    return new Transform({
      decodeStrings: false,
      async transform(chunk, _, cb) {
        if (typeof(chunk) !== 'string') {
          cb(new TypeError(`Expected chunk to be a string, but received ${typeof chunk}`));
          return;
        }
        const pushT = (chunk: string) => { this.push(chunk); }
        const pushK = async (chunk: string) => { this.push(await handleAsyncableReplacer(chunk, replacer)); }
        await aho.processTextAsync(session, chunk, collector, pushT, pushK, stop);
        cb();
      },
      async flush(cb) {
        const pushT = (chunk: string) => { this.push(chunk); }
        const pushK = async (chunk: string) => { this.push(await handleAsyncableReplacer(chunk, replacer)); }
        await aho.cleanupTextAsync(session, collector, pushT, pushK, stop);
        cb();
      }
    });
  }
}

