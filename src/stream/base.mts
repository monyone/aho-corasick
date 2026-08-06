import Collector from "./collector.mts";
import Deque from "./deque.mts";

export type Match = { begin: number, end: number, keyword: string };
export type BoundaryTarget = (keyword: string) => boolean;
export type BoundaryFunc = (left: string, right: string) => boolean;
export type CollectorFunc = (chunk: string) => void;
export type DetectFunc = (keyword: string) => void;
export type AsyncableDetectFunc = (keyword: string) => void | PromiseLike<void>

export type BoundaryEntry = { target: BoundaryTarget, boundary: BoundaryFunc };
const isAsciiChars = (
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "0123456789" +
  "_&#+-/"
);
const isAsciiCharSet = new Set(isAsciiChars.split(''));
const isAsciiChar = (ch: string) => isAsciiCharSet.has(ch);

export const Boundary = {
  WhiteSpace: (): BoundaryEntry => {
    const isBoundary = (ch: string) => /\s/.test(ch);
    const target = (t: string) => t.length > 0;
    const boundary = (left: string, right: string) => isBoundary(left) || isBoundary(right);
    return { target, boundary };
  },
  By: (separator: RegExp): BoundaryEntry => {
    const matcher = new RegExp(separator.source, separator.flags.replace(/[gy]/g, ''));
    const target = (t: string) => t.length > 0;
    const boundary = (left: string, right: string) => matcher.test(left) || matcher.test(right);
    return { target, boundary };
  },
  AsciiTerm: (): BoundaryEntry => {
    const cls = isAsciiChars.replace(/[\\\]^-]/g, "\\$&");
    const pattern = new RegExp(`^[${cls}](?:[${cls}\\s]*[${cls}])?$`);
    const target = (t: string) => t.length === 0 ? false : pattern.test(t);
    const boundary = (left: string, right: string) => !(isAsciiChar(left) && isAsciiChar(right));
    return { target, boundary };
  },
  AsciiEdge: (): BoundaryEntry => {
    const target = (t: string) => t.length === 0 ? false : isAsciiChar(t[0]) || isAsciiChar(t[t.length - 1]);
    const boundary = (left: string, right: string) => !(isAsciiChar(left) && isAsciiChar(right));
    return { target, boundary };
  },
} as const satisfies Record<string, (... args: any[]) => BoundaryEntry>;

const OPEN: unique symbol = Symbol();
const CLOSE: unique symbol = Symbol();
type Sentinel = typeof OPEN | typeof CLOSE;
export const STOP_BEGIN: unique symbol = Symbol();
export const STOP_DUMMY: unique symbol = Symbol();
export const STOP_END: unique symbol = Symbol();
export type Stop = typeof STOP_BEGIN | typeof STOP_END;
export type Sym = string | Sentinel | typeof STOP_DUMMY;

export interface StopFilter {
  write(chunk: string, entry?: BoundaryEntry): Iterable<string | Stop>;
  end(entry?: BoundaryEntry): Iterable<string | Stop>;
}

export const STOP_TYPE = {
  NONE: 'NONE',
  BEGIN: 'BEGIN',
  INPROGRESS: 'INPROGRESS',
} as const;
export type STOP_TYPE = (typeof STOP_TYPE)[keyof typeof STOP_TYPE];

const withSentinel = (keyword: string, entry?: BoundaryEntry): (Sym[] | string)[] => {
  if (entry == null) {return [keyword]; }
  if (keyword === '') {
    if (entry.target(keyword)) {
      return [[OPEN, CLOSE]];
    } else {
      return [
        [OPEN, CLOSE],
        [CLOSE],
        [OPEN],
      ];
    }
  }

  const syms: Sym[] = [keyword[0]];
  for (let i = 1; i < keyword.length; i++) {
    if (entry.boundary(keyword[i - 1], keyword[i - 0])) {
      syms.push(CLOSE, OPEN);
    }
    syms.push(keyword[i]);
  }

  if (entry.target(keyword)) {
    return [[OPEN, ... syms, CLOSE]]
  } else {
    return [
      [OPEN, ... syms, CLOSE],
      [... syms, CLOSE],
      [OPEN, ... syms],
      [... syms],
    ];
  }
};

export const isPromiseLike = <T,>(value: unknown): value is PromiseLike<T> => {
  const isObject = typeof(value) === "object" && value !== null;
  const isFunction = typeof(value) === "function";
  return (isObject || isFunction) && typeof((value as PromiseLike<T>).then) === "function";
};

export class CRTPTrie<T, K, Self extends CRTPTrie<T, K, Self>> {
  public readonly parent: Self | null = null;
  public readonly depth: number;
  private keyword: K | null = null;
  private goto: Map<T, Self> = new Map<T, Self>();
  public failure: Self | null = null;

  public constructor(parent?: Self, depth: 0 | 1 = 1) {
    this.parent = parent ?? null;
    this.depth = parent == null ? 0 : parent.depth + depth;
  }

  public can(s: T): boolean {
    return this.goto.has(s);
  }
  public go(s: T): Self | undefined {
    return this.goto.get(s);
  }
  public define(s: T, next: Self): void {
    this.goto.set(s, next);
  }
  public undef(s: T): void {
    this.goto.delete(s);
  }
  public entries(): MapIterator<[T, Self]> {
    return this.goto.entries();
  }

  public empty(): boolean {
    return this.keyword == null;
  }
  public add(k: K): void {
    this.keyword = k;
  }
  public value(): K | null {
    return this.keyword;
  }
  public merge(t?: Self): void {
    this.keyword ??= t?.keyword ?? null;
  }
}

export abstract class AbstractStreamAhoCorasick<Node extends CRTPTrie<Sym, string, Node>> {
  protected readonly boundaryConfig?: BoundaryEntry;
  protected root: Node;
  protected readonly maxSequenceLength: number = 0;
  protected readonly dequeCapacity: number;
  protected readonly maintainLength: number;

  constructor(keywords: string[], factory: (parent?: Node, depth?: 0 | 1) => Node, boundary?: BoundaryEntry) {
    this.root = factory();
    this.boundaryConfig = boundary;

    // build goto
    for (const keyword of keywords) {
      for (const sequence of withSentinel(keyword, this.boundaryConfig)) {
        this.maxSequenceLength = Math.max(this.maxSequenceLength, sequence.length);
        let current = this.root;
        for (let i = 0; i < sequence.length; i++) {
          const ch = sequence[i];
          const width = typeof(ch) === 'string' ? 1 : 0
          let next = current.go(ch) ?? factory(current, width);
          current.define(ch, next);
          current = next;
        }
        current.add(keyword);
      }
    }
    this.dequeCapacity = this.maxSequenceLength + 1;
    this.maintainLength = this.maxSequenceLength * 2;

    // build failure
    {
      let top = 0;
      const queue: [Node, Sym][] = [];
      for (const [ch, next] of this.root.entries()) {
        queue.push([next, ch]);
      }
      while (top < queue.length) {
        const data = queue[top++];
        const current = data[0];
        const ch = data[1];
        const parent = current.parent!;

        // calc failure
        if (current.empty()) {
          let failure = parent.failure;
          while (failure != null && !failure.can(ch)) {
            failure = failure.failure;
          }
          failure = failure?.go(ch) ?? this.root;

          current.failure = failure;
          current.merge(failure);
        } else {
          current.failure = this.root;
        }

        for (const [ch, next] of current.entries()) {
          queue.push([next, ch]);
        }
      }
    }
  }

  private maintainAmortization(deque: Deque<Match>, collector: Collector, confirmed_index: number): number {
    if (confirmed_index <= this.maintainLength) { return confirmed_index; }

    for (const elem of deque) {
      elem.begin -= confirmed_index;
      elem.end -= confirmed_index;
    }
    collector.reposition(confirmed_index);
    return 0;
  }

  private maintainDeque(trie: Node, deque: Deque<Match>, index: number, offset: number): void {
    if (trie.empty()) { return; }

    const keyword = trie.value()!;
    const length = keyword.length;
    const begin = index + offset - length;
    const end = index + offset;

    while (true) {
      if (deque.empty()) {
        deque.addLast({ begin, end, keyword });
        break;
      }

      const last = deque.peekLast()!;
      if (last.end <= begin && last.begin < begin) {
        deque.addLast({ begin, end, keyword });
        break;
      } else if (begin > last.begin) {
        break;
      } else {
        deque.pollLast();
      }
    }
  }

  private processTextInternalSync(state: Node, deque: Deque<Match>, chunk: string, prev: string | null, stop: STOP_TYPE, confirmed_offset: number, collector: Collector, collect: CollectorFunc, detect: DetectFunc): [trie: Node, prev: string | null, confirmed_offset: number] {
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    let index = 0;
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      let sentinel: Sentinel | null = null;
      if (this.boundaryConfig != null) {
        if (prev == null) { sentinel = OPEN; }
        else if (this.boundaryConfig.boundary(prev, char)) { sentinel = CLOSE; }
      }

      LOOP:
      while (true) {
        const ch: Sym = sentinel ?? (stop !== STOP_TYPE.NONE ? STOP_DUMMY : char);
        const width = (ch === STOP_DUMMY || typeof(ch) === 'string') ? 1 : 0;

        // stop 継続中 or stop 始まりの次文字 から stop
        // この時は deque を操作すると空文字を検出してしまうので入れない
        if (stop === STOP_TYPE.NONE || (stop === STOP_TYPE.BEGIN && index === 0)) {
          this.maintainDeque(state, deque, index, remain_offset);
          // 空キーワード の場合は追加対応
          this.maintainDeque(this.root, deque, index, remain_offset);
        }

        let next = state.go(ch);
        if (next == null) { // use failure
          const old_depth = state.depth;
          while (state !== this.root && next == null) {
            state = state.failure!;
            next = state.go(ch);
          }

          const new_depth = state.depth;
          confirmed_index += (old_depth - new_depth) + (next != null ? 0 : width);
          while (!deque.empty()) {
            const first = deque.peekFirst()!;
            if (first.begin >= confirmed_index) { break; }

            if (output_begin < first.begin) {
              collector.consume(first.begin - output_begin, collect);
            }
            collector.skip(first.end - first.begin);
            detect(first.keyword);
            output_begin = first.end;

            deque.pollFirst()!;
          }
        }
        state = next ?? this.root;
        index += width;

        switch (sentinel) {
          case CLOSE: sentinel = OPEN; break;
          case OPEN: sentinel = null; break;
          default: break LOOP;
        }
      }
      prev = char;
    }

    if (output_begin < confirmed_index) {
      collector.consume(confirmed_index - output_begin, collect);
      output_begin = confirmed_index;
    }
    confirmed_offset = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, prev, confirmed_offset];
  }
  private async processTextInternalAsync(state: Node, deque: Deque<Match>, chunk: string, prev: string | null, stop: STOP_TYPE, confirmed_offset: number, collector: Collector, collect: CollectorFunc, detect: AsyncableDetectFunc): Promise<[trie: Node, prev: string | null, confirmed_offset: number]> {
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    let index = 0;
    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      let sentinel: Sentinel | null = null;
      if (this.boundaryConfig != null) {
        if (prev == null) { sentinel = OPEN; }
        else if (this.boundaryConfig.boundary(prev, char)) { sentinel = CLOSE; }
      }

      LOOP:
      while (true) {
        const ch: Sym = sentinel ?? (stop !== STOP_TYPE.NONE ? STOP_DUMMY : char);
        const width = (ch === STOP_DUMMY || typeof(ch) === 'string') ? 1 : 0;

        // stop 継続中 or stop 始まりの次文字 から stop
        // この時は deque を操作すると空文字を検出してしまうので入れない
        if (stop === STOP_TYPE.NONE || (stop === STOP_TYPE.BEGIN && index === 0)) {
          this.maintainDeque(state, deque, index, remain_offset);
          // 空キーワード の場合は追加対応
          this.maintainDeque(this.root, deque, index, remain_offset);
        }

        let next = state.go(ch);
        if (next == null) { // use failure
          const old_depth = state.depth;
          while (state !== this.root && next == null) {
            state = state.failure!;
            next = state.go(ch);
          }

          const new_depth = state.depth;
          confirmed_index += (old_depth - new_depth) + (next != null ? 0 : width);
          while (!deque.empty()) {
            const first = deque.peekFirst()!;
            if (first.begin >= confirmed_index) { break; }

            if (output_begin < first.begin) {
              collector.consume(first.begin - output_begin, collect);
            }
            {
              collector.skip(first.end - first.begin);
              const maybe = detect(first.keyword);
              if(isPromiseLike<void>(maybe)) { await maybe; };
            }
            output_begin = first.end;

            deque.pollFirst()!;
          }
        }
        state = next ?? this.root;
        index += width;

        switch (sentinel) {
          case CLOSE: sentinel = OPEN; break;
          case OPEN: sentinel = null; break;
          default: break LOOP;
        }
      }
      prev = char;
    }

    if (output_begin < confirmed_index) {
      collector.consume(confirmed_index - output_begin, collect);
      output_begin = confirmed_index;
    }
    confirmed_offset = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, prev, confirmed_offset];
  }

  protected processTextSync<T, K>(state: Node, deque: Deque<Match>, chunk: string, prev: string | null, stop: STOP_TYPE, confirmed_index: number, collector: Collector, collect: CollectorFunc, detect: DetectFunc, filter?: StopFilter): [trie: Node, prev: string | null, stop: STOP_TYPE, confirmed_offset: number] {
    if (filter == null) {
      [state, prev, confirmed_index] = this.processTextInternalSync(state, deque, chunk, prev, stop, confirmed_index, collector, collect, detect);
    } else {
      for (const syms of filter.write(chunk, this.boundaryConfig)) {
        switch (syms) {
          case STOP_BEGIN: stop = STOP_TYPE.BEGIN; break;
          case STOP_END: stop = STOP_TYPE.NONE; break;
          default: {
            [state, prev, confirmed_index] = this.processTextInternalSync(state, deque, syms, prev, stop, confirmed_index, collector, collect, detect);
            stop = stop === STOP_TYPE.BEGIN ? STOP_TYPE.INPROGRESS : stop;
          }
        }
      }
    }
    return [state, prev, stop, confirmed_index];
  }
  protected async processTextAsync<T, K>(state: Node, deque: Deque<Match>, chunk: string, prev: string | null, stop: STOP_TYPE, confirmed_index: number, collector: Collector, collect: CollectorFunc, detect: AsyncableDetectFunc, filter?: StopFilter): Promise<[trie: Node, prev: string | null, stop: STOP_TYPE, confirmed_offset: number]> {
    if (filter == null) {
      [state, prev, confirmed_index] = await this.processTextInternalAsync(state, deque, chunk, prev, stop, confirmed_index, collector, collect, detect);
    } else {
      for (const syms of filter.write(chunk, this.boundaryConfig)) {
        switch (syms) {
          case STOP_BEGIN: stop = STOP_TYPE.BEGIN; break;
          case STOP_END: stop = STOP_TYPE.NONE; break;
          default: {
            [state, prev, confirmed_index] = await this.processTextInternalAsync(state, deque, syms, prev, stop, confirmed_index, collector, collect, detect);
            stop = stop === STOP_TYPE.BEGIN ? STOP_TYPE.INPROGRESS : stop;
          }
        }
      }
    }
    return [state, prev, stop, confirmed_index];
  }

  private cleanupTextInternalSync(state: Node, deque: Deque<Match>, prev: string | null, stop: STOP_TYPE, confirmed_index: number, collector: Collector, collect: CollectorFunc, detect: DetectFunc): void {
    const remain_offset = collector.length;
    const maintainDequeIfNeeded = (state: Node) => {
      if (stop === STOP_TYPE.INPROGRESS) { return; }
      this.maintainDeque(state, deque, 0, remain_offset);
    }

    if (this.boundaryConfig != null) {
      if (prev == null) {
        let next = state.go(OPEN);
        while (state !== this.root && next == null) {
          state = state.failure!;
          next = state.go(OPEN);
        }
        state = next ?? this.root;
        maintainDequeIfNeeded(state);
      }

      let next = state.go(CLOSE);
      while (state !== this.root && next == null) {
        state = state.failure!;
        next = state.go(CLOSE);
      }
      state = next ?? this.root;
    }
    maintainDequeIfNeeded(state);
    // 空キーワード の場合は追加対応
    maintainDequeIfNeeded(this.root);

    let output_begin = confirmed_index;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        collector.consume(first.begin - output_begin, collect);
      }
      collector.skip(first.end - first.begin);
      detect(first.keyword);

      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      collector.consume(collector.length - output_begin, collect);
    }
  }
  private async cleanupTextInternalAsync(state: Node, deque: Deque<Match>, prev: string | null, stop: STOP_TYPE, confirmed_index: number, collector: Collector, collect: CollectorFunc, detect: AsyncableDetectFunc): Promise<void> {
    const remain_offset = collector.length;
    const maintainDequeIfNeeded = (state: Node) => {
      if (stop === STOP_TYPE.INPROGRESS) { return; }
      this.maintainDeque(state, deque, 0, remain_offset);
    }

    if (this.boundaryConfig != null) {
      if (prev == null) {
        let next = state.go(OPEN);
        while (state !== this.root && next == null) {
          state = state.failure!;
          next = state.go(OPEN);
        }
        state = next ?? this.root;
        maintainDequeIfNeeded(state);
      }

      let next = state.go(CLOSE);
      while (state !== this.root && next == null) {
        state = state.failure!;
        next = state.go(CLOSE);
      }
      state = next ?? this.root;
    }
    maintainDequeIfNeeded(state)
    // 空キーワード の場合は追加対応
    maintainDequeIfNeeded(this.root);

    let output_begin = confirmed_index;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        collector.consume(first.begin - output_begin, collect);
      }
      {
        collector.skip(first.end - first.begin);
        const maybe = detect(first.keyword);
        if(isPromiseLike<void>(maybe)) { await maybe; };
      }
      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      collector.consume(collector.length - output_begin, collect);
    }
  }

  protected cleanupTextSync(state: Node, deque: Deque<Match>, prev: string | null, stop: STOP_TYPE, confirmed_index: number, collector: Collector, collect: CollectorFunc, detect: DetectFunc, filter?: StopFilter): void {
    if (filter != null) {
      for (const syms of filter.end(this.boundaryConfig)) {
        switch (syms) {
          case STOP_BEGIN: stop = STOP_TYPE.BEGIN; break;
          case STOP_END: stop = STOP_TYPE.NONE; break;
          default: {
            [state, prev, confirmed_index] = this.processTextInternalSync(state, deque, syms, prev, stop, confirmed_index, collector, collect, detect);
            stop = stop === STOP_TYPE.BEGIN ? STOP_TYPE.INPROGRESS : stop;
          }
        }
      }
    }
    this.cleanupTextInternalSync(state, deque, prev, stop, confirmed_index, collector, collect, detect);
  }
  protected async cleanupTextAsync(state: Node, deque: Deque<Match>, prev: string | null, stop: STOP_TYPE, confirmed_index: number, collector: Collector, collect: CollectorFunc, detect: AsyncableDetectFunc, filter?: StopFilter): Promise<void> {
    if (filter != null) {
      for (const syms of filter.end(this.boundaryConfig)) {
        switch (syms) {
          case STOP_BEGIN: stop = STOP_TYPE.BEGIN; break;
          case STOP_END: stop = STOP_TYPE.NONE; break;
          default: {
            [state, prev, confirmed_index] = await this.processTextInternalAsync(state, deque, syms, prev, stop, confirmed_index, collector, collect, detect);
            stop = stop === STOP_TYPE.BEGIN ? STOP_TYPE.INPROGRESS : stop;
          }
        }
      }
    }
    this.cleanupTextInternalAsync(state, deque, prev, stop, confirmed_index, collector, collect, detect);
  }
}

export class Trie extends CRTPTrie<Sym, string, Trie> {}

export abstract class AbstractStreamGeneralAhoCorasick extends AbstractStreamAhoCorasick<Trie> {
  constructor(keywords: string[], boundary?: BoundaryEntry) {
    super(keywords, (parent, depth) => new Trie(parent, depth), boundary);
  }
}

export class TentativeTrie extends CRTPTrie<Sym, string, TentativeTrie> {
  public tentative: string | null = null;
}

export abstract class AbstractStreamTentativeAhoCorasick extends AbstractStreamAhoCorasick<TentativeTrie> {
  constructor(keywords: string[], boundary?: BoundaryEntry) {
    super(keywords, (parent, depth) => new TentativeTrie(parent, depth), boundary);

    // build tentative
    this.root.tentative = '';
    for (const keyword of keywords) {
      for (const sequence of withSentinel(keyword, this.boundaryConfig)) {
        let current = this.root;
        for (let i = 0; i < sequence.length; i++) {
          const ch = sequence[i];
          current = current.go(ch)!;
        }

        while (current.tentative == null) {
          // 本当は string に対する view で範囲を縮めて見れれば一番いいんだけど...
          // slice は Node, Deno, Bun で slice をとると CoW でそういう挙動をしてくれる
          current.tentative = keyword.slice(0, current.depth);
          // あと、これに O(N) かかったとしても、検索時の劣化がなければ別にいい

          current = current.parent!;
        }
      }
    }
  }
}
