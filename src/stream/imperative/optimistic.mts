import Collector from "../collector.mts";
import { AbstractStreamOptimisticAhoCorasick, type StopFilter } from "../base.mts";
import type { ImperativeResult } from "./normal.mts";
import { StringBuffer } from "../stringbuffer.mts";

export { Boundary } from "../base.mts";
export type { BoundaryEntry, BoundaryFunc, BoundaryTarget, Match, StopFilter } from "../base.mts";
export * from '../filter/index.mts'

export type ImperativeWithOptimisticResult<T, K> = {
  confirmed : ImperativeResult<T, K>;
  optimistic: ImperativeResult<T, K>;
};
export type ImperativeWithOptimisticHandle<T, K> = {
  write(chunk: string): ImperativeWithOptimisticResult<T, K>;
  end(): ImperativeResult<T, K>;
};
const ImperativeWithOptimisticHandle = {
  from<T, K>(write: (chunk: string) => ImperativeWithOptimisticResult<T, K>, end: () => ImperativeResult<T, K>): ImperativeWithOptimisticHandle<T, K> {
    return { write, end };
  }
}

export class AhoCorasick<T, K> extends AbstractStreamOptimisticAhoCorasick<T, K> {
  /* 意味論的に Async は評価タイミング、replace は string 制約を表現できない */

  public tokenizeSync(stop?: StopFilter): ImperativeWithOptimisticHandle<T, K> {
    const session = this.makeSession(this.dequeCapacity);
    const collector = new Collector(this.maintainLength);

    const write = (chunk: string): ImperativeWithOptimisticResult<T, K> => {
      const confirmed = new StringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, this.normal);
      const pushK = confirmed.push.bind(confirmed, this.target);
      this.processTextSync(session, chunk, collector, pushT, pushK, stop);
      return { confirmed: confirmed.data() , optimistic: session.state.optimistic! }
    };
    const end = (): ImperativeResult<T, K> => {
      const confirmed = new StringBuffer<T, K>();
      const pushT = confirmed.push.bind(confirmed, this.normal);
      const pushK = confirmed.push.bind(confirmed, this.target);
      this.cleanupTextSync(session, collector, pushT, pushK, stop);
      return confirmed.data();
    };
    return ImperativeWithOptimisticHandle.from<T, K>(write, end);
  }
}

