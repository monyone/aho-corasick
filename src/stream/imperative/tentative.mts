import { type Replacer, type AsyncableReplacer,handleAsyncableReplacer, handleReplacer } from "../stream.mts";
import Collector from "../collector.mts";
import { AbstractStreamTentativeAhoCorasick, type StopFilter } from "../base.mts";
import type { AsyncImperativeResult, ImperativeResult } from "./normal.mts";
import { AsyncableStringBuffer, StringBuffer } from "../stringbuffer.mts";

export { Replacer, AsyncableReplacer } from "../stream.mts";
export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export * from '../filter/index.mts'

export type ImperativeWithTentativeResult<T, K, U> = {
  confirmed : ImperativeResult<T, K>;
  tentative: U;
};
export type ImperativeWithTentativeHandle<T, K, U> = {
  write(chunk: string): ImperativeWithTentativeResult<T, K, U>;
  end(): ImperativeResult<T, K>;
};
const ImperativeWithTentativeHandle = {
  from<T, K, U>(write: (chunk: string) => ImperativeWithTentativeResult<T, K, U>, end: () => ImperativeResult<T, K>): ImperativeWithTentativeHandle<T, K, U> {
    return { write, end };
  }
}

export type AsyncImperativeWithTentativeResult<T, K, U> = Promise<{
  confirmed : ImperativeResult<T, K>;
  tentative: U;
}>;
export type AsyncImperativeWithTentativeHandle<T, K, U> = {
  write(chunk: string): AsyncImperativeWithTentativeResult<T, K, U>;
  end(): AsyncImperativeResult<T, K>;
};
const AsyncImperativeWithTentativeHandle = {
  from<T, K, U>(write: (chunk: string) => AsyncImperativeWithTentativeResult<T, K, U>, end: () => AsyncImperativeResult<T, K>): AsyncImperativeWithTentativeHandle<T, K, U> {
    return { write, end };
  }
};

export class AhoCorasick extends AbstractStreamTentativeAhoCorasick {
  public replaceSync(replacer: Replacer, stop?: StopFilter): ImperativeWithTentativeHandle<string, string, string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = (keyword: string) => handleReplacer(keyword, replacer);

    const write = (chunk: string): ImperativeWithTentativeResult<string, string, string> => {
      const confirmed = new StringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      this.processTextSync(session, chunk, collector, pushT, pushK, stop);
      return { confirmed: confirmed.data() , tentative: session.state.tentative! }
    };
    const end = (): ImperativeResult<string, string> => {
      const confirmed = new StringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return ImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public replaceAsync(replacer: AsyncableReplacer, stop?: StopFilter): AsyncImperativeWithTentativeHandle<string, string, string> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);
    const identity = (text: string) => text;
    const replace = async (keyword: string) => await handleAsyncableReplacer(keyword, replacer);

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<string, string, string> => {
      const confirmed = new AsyncableStringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      await this.processTextAsync(session, chunk, collector, pushT, pushK, stop);
      return { confirmed: confirmed.data(), tentative: session.state.tentative! }
    };
    const end = async (): AsyncImperativeResult<string, string> => {
      const confirmed = new AsyncableStringBuffer<string, string>();
      const pushT = confirmed.push.bind(confirmed, identity);
      const pushK = confirmed.push.bind(confirmed, replace);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return AsyncImperativeWithTentativeHandle.from<string, string, string>(write, end);
  }

  public tokenizeSync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K, tentative: (tentative: string) => U, stop?: StopFilter): ImperativeWithTentativeHandle<T, K, U> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    const write = (chunk: string): ImperativeWithTentativeResult<T, K, U> => {
      const confirmed = new StringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      this.processTextSync(session, chunk, collector, pushT, pushK, stop);
      return { confirmed: confirmed.data() , tentative: tentative(session.state.tentative!) }
    };
    const end = (): ImperativeResult<T, K> => {
      const confirmed = new StringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return ImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }

  public tokenizeAsync<T, K, U>(normal: (chunk: string) => T, target: (keyword: string) => K | PromiseLike<K>, tentative: (tentative: string) => U, stop?: StopFilter): AsyncImperativeWithTentativeHandle<T, K, U> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    const write = async (chunk: string): AsyncImperativeWithTentativeResult<T, K, U> => {
      const confirmed = new AsyncableStringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      await this.processTextAsync(session, chunk, collector, pushT, pushK, stop);
      return { confirmed: confirmed.data(), tentative: tentative(session.state.tentative!) }
    };
    const end = async (): AsyncImperativeResult<T, K> => {
      const confirmed = new AsyncableStringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, normal);
      const pushK = confirmed.push.bind(confirmed, target);
      await this.cleanupTextAsync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return AsyncImperativeWithTentativeHandle.from<T, K, U>(write, end);
  }
}

