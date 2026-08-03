import Collector from "./collector.mts";
import Deque from "./deque.mts";

export type Match = { begin: number, end: number, keyword: string };
export type BoundaryTarget = (keyword: string) => boolean;
export type BoundaryFunc = (left: string, right: string) => boolean;
export type CollectorFunc<T> = (begin: number, end: number) => Iterable<T>
export type DetectFunc<K> = (keyword: string) => K;
export type AsyncableDetectFunc<K> = (keyword: string) => K | Promise<K>;

export type BoundaryEntry = { target: BoundaryTarget, boundary: BoundaryFunc };
export const Boundary = {
  WhiteSpace: (): BoundaryEntry => {
    const isBoundary = (ch: string) => /\s/.test(ch);
    const target = () => true;
    const boundary = (left: string, right: string) => isBoundary(left) || isBoundary(right);
    return { target, boundary };
  },
  By: (separator: RegExp): BoundaryEntry => {
    const target = () => true;
    const boundary = (left: string, right: string) => separator.test(left) || separator.test(right);
    return { target, boundary };
  },
  AsciiTerm: (): BoundaryEntry => {
    const isAsciiChar = (ch: string) => /[A-Za-z0-9_&#+.-]/.test(ch);
    const target = (t: string) => /^[A-Za-z0-9_&#+.-](?:[A-Za-z0-9_&#+.\s-]*[A-Za-z0-9_&#+.-])?$/.test(t);
    const boundary = (left: string, right: string) => !(isAsciiChar(left) && isAsciiChar(right));
    return { target, boundary };
  },
  AsciiEdge: (): BoundaryEntry => {
    const isAsciiChar = (ch: string) => /[A-Za-z0-9_&#+.-]/.test(ch);
    // if neither edge char is ascii, the boundary holds against any neighbor, so sentinels are omittable
    const target = (t: string) => t.length === 0 ? false : isAsciiChar(t[0]) || isAsciiChar(t[t.length - 1]);
    const boundary = (left: string, right: string) => !(isAsciiChar(left) && isAsciiChar(right));
    return { target, boundary };
  },
} as const satisfies Record<string, (... args: any[]) => BoundaryEntry>;

const OPEN: unique symbol = Symbol();
const CLOSE: unique symbol = Symbol();
type Sentinel = typeof OPEN | typeof CLOSE;
type Sym = string | Sentinel;

const withSentinel = (keyword: string, entry?: BoundaryEntry): Sym[][] => {
  if (entry == null) { return [keyword.split('')]; }
  if (keyword === '') {
    if (entry.target(keyword)) {
      return [[OPEN, CLOSE]];
    } else {
      return [
        [OPEN, CLOSE],
        [CLOSE],
        [OPEN],
        [],
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
}

export class Trie<T, K> {
  public readonly parent: Trie<T, K> | null = null;
  public readonly depth: number;
  private keyword: K | null = null;
  private goto: Map<T, Trie<T, K>> = new Map<T, Trie<T, K>>();

  public constructor(parent?: Trie<T, K>, depth: 0 | 1 = 1) {
    this.parent = parent ?? null;
    this.depth = parent == null ? 0 : parent.depth + depth;
  }

  public can(s: T) {
    return this.goto.has(s);
  }
  public go(s: T) {
    return this.goto.get(s);
  }
  public define(s: T, next: Trie<T, K>) {
    return this.goto.set(s, next);
  }
  public undef(s: T) {
    this.goto.delete(s);
  }
  public entries() {
    return this.goto.entries();
  }

  public empty() {
    return this.keyword == null;
  }
  public add(k: K) {
    this.keyword = k;
  }
  public value() {
    return this.keyword;
  }
  public merge(t?: Trie<T, K>) {
    this.keyword ??= t?.keyword ?? null;
  }
}
export abstract class AbstractStreamAhoCorasick {
  protected readonly boundaryConfig?: BoundaryEntry;
  protected root = new Trie<Sym, string>();
  protected failure_link = new Map<Trie<Sym, string>, Trie<Sym, string>>();
  protected readonly maxKeywordLength: number = 0;
  protected readonly maintainLength: number = 0;
  protected readonly ringbufferCapacity: number = 0;

  constructor(keywords: string[], boundary?: BoundaryEntry) {
    this.boundaryConfig = boundary;

    // build goto
    for (const keyword of keywords) {
      this.maxKeywordLength = Math.max(this.maxKeywordLength, keyword.length);
      for (const sequence of withSentinel(keyword, this.boundaryConfig)) {
        let current = this.root;
        for (let i = 0; i < sequence.length; i++) {
          const ch = sequence[i];
          const width = typeof(ch) === 'string' ? 1 : 0
          let next = current.go(ch) ?? (new Trie(current, width));
          current.define(ch, next);
          current = next;
        }
        current.add(keyword);
      }
    }
    this.maintainLength = this.maxKeywordLength * 2;

    // build failure
    {
      let top = 0;
      const queue: [Trie<Sym, string>, Sym][] = [];
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
          let failure = this.failure_link.get(parent) ?? null;
          while (failure != null && !failure.can(ch)) {
            failure = this.failure_link.get(failure) ?? null;
          }
          failure = failure?.go(ch) ?? this.root;
          this.failure_link.set(current, failure);
          current.merge(failure);
        } else {
          this.failure_link.set(current, this.root);
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

  private maintainDeque(trie: Trie<Sym, string>, deque: Deque<Match>, index: number, offset: number): void {
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

  private symbolize(chunk: string, prev: string | null): Sym[] {
    if (this.boundaryConfig == null) { return chunk.split(''); }
    const syms: Sym[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      if (prev == null) {
        syms.push(OPEN);
      } else if (this.boundaryConfig.boundary(prev, ch)) {
        syms.push(CLOSE, OPEN);
      }
      syms.push(ch);
      prev = ch;
    }
    return syms;
  }

  protected *processTextSync<T, K>(state: Trie<Sym, string>, deque: Deque<Match>, chunk: string, prev: string | null, confirmed_offset: number, collector: Collector, collect: CollectorFunc<T>, detect: DetectFunc<K>): Generator<T | K, [trie: Trie<Sym, string>, prev: string | null, confirmed_offset: number], unknown> {
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    const symbols = this.symbolize(chunk, prev);
    prev = chunk.length > 0 ? chunk[chunk.length - 1] : prev;
    let index = 0;
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      const width = typeof(ch) === 'string' ? 1 : 0;

      this.maintainDeque(state, deque, index, remain_offset);
      // 空キーワード の場合は追加対応
      this.maintainDeque(this.root, deque, index, remain_offset);

      if (!state.can(ch)) { // use failure
        const old_depth = state.depth;
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }

        const new_depth = state.depth;
        confirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : width);
        while (!deque.empty()) {
          const first = deque.peekFirst()!;
          if (first.begin >= confirmed_index) { break; }

          if (output_begin < first.begin) {
            yield* collect(output_begin, first.begin);
          }
          collector.skip(first.end - first.begin);
          yield detect(first.keyword);
          output_begin = first.end;

          deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;
      index += width;
    }

    if (output_begin < confirmed_index) {
      yield* collect(output_begin, confirmed_index);
      output_begin = confirmed_index;
    }
    confirmed_offset = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, prev, confirmed_offset];
  }
  protected async *processTextAsync<T, K>(state: Trie<Sym, string>, deque: Deque<Match>, chunk: string, prev: string | null, confirmed_offset: number, collector: Collector, collect: CollectorFunc<T>, detect: AsyncableDetectFunc<K>): AsyncGenerator<T | K, [trie: Trie<Sym, string>, prev: string | null, confirmed_offset: number], unknown> {
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    const symbols = this.symbolize(chunk, prev);
    prev = chunk.length > 0 ? chunk[chunk.length - 1] : prev;
    let index = 0;
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      const width = typeof(ch) === 'string' ? 1 : 0;

      this.maintainDeque(state, deque, index, remain_offset);
      // 空キーワード の場合は追加対応
      this.maintainDeque(this.root, deque, index, remain_offset);

      if (!state.can(ch)) { // use failure
        const old_depth = state.depth;
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
        const new_depth = state.depth;
        confirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : width);
        while (!deque.empty()) {
          const first = deque.peekFirst()!;
          if (first.begin >= confirmed_index) { break; }

          if (output_begin < first.begin) {
            yield* collect(output_begin, first.begin);
          }
          {
            collector.skip(first.end - first.begin);
            const replaced = detect(first.keyword);
            yield !(replaced instanceof Promise) ? replaced : await replaced;
          }
          output_begin = first.end;

          deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;
      index += width;
    }

    if (output_begin < confirmed_index) {
      yield* collect(output_begin, confirmed_index);
      output_begin = confirmed_index;
    }
    confirmed_offset = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, prev, confirmed_offset];
  }

  protected *cleanupTextSync<T, K>(state: Trie<Sym, string>, deque: Deque<Match>, confirmed_index: number, collector: Collector, collect: CollectorFunc<T>, detect: DetectFunc<K>): Iterable<T | K> {
    const remain_offset = collector.length;

    if (this.boundaryConfig != null) {
      while (state !== this.root && !(state.can(CLOSE))) {
        state = this.failure_link.get(state)!;
      }
      state = state.go(CLOSE) ?? this.root;
    }
    this.maintainDeque(state, deque, 0, remain_offset);
    // 空キーワード の場合は追加対応
    this.maintainDeque(this.root, deque, 0, remain_offset);

    let output_begin = confirmed_index;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield* collect(output_begin, first.begin);
      }
      collector.skip(first.end - first.begin);
      yield detect(first.keyword);

      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      yield* collect(output_begin, collector.length);
    }
  }
  protected async *cleanupTextAsync<T, K>(state: Trie<Sym, string>, deque: Deque<Match>, confirmed_index: number, collector: Collector, collect: CollectorFunc<T>, detect: AsyncableDetectFunc<K>): AsyncIterable<T | K> {
    const remain_offset = collector.length;
    if (this.boundaryConfig != null) {
      this.maintainDeque(state, deque, 0, remain_offset);
      while (state !== this.root && !(state.can(CLOSE))) {
        state = this.failure_link.get(state)!;
      }
      state = state.go(CLOSE) ?? this.root;
    }
    this.maintainDeque(state, deque, 0, remain_offset);
    // 空キーワード の場合は追加対応
    this.maintainDeque(this.root, deque, 0, remain_offset);

    let output_begin = confirmed_index;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield* collect(output_begin, first.begin);
      }
      {
        collector.skip(first.end - first.begin);
        const replaced = detect(first.keyword);
        yield !(replaced instanceof Promise) ? replaced : await replaced;
      }
      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      yield* collect(output_begin, collector.length);
    }
  }
}

export abstract class AbstractStreamTentativeAhoCorasick extends AbstractStreamAhoCorasick {
  protected tentative = new Map<Trie<Sym, string>, string>();

  constructor(keywords: string[], boundary?: BoundaryEntry) {
    super(keywords, boundary);

    // build tentative
    this.tentative.set(this.root, '')
    for (const keyword of keywords) {
      for (const sequence of withSentinel(keyword, this.boundaryConfig)) {
        let current = this.root;
        for (let i = 0; i < sequence.length; i++) {
          const ch = sequence[i];
          let next = current.go(ch) ?? (new Trie(current))
          current.define(ch, next);
          current = next;
        }

        while (!this.tentative.has(current)) {
          // 本当は string に対する view で範囲を縮めて見れれば一番いいんだけど...
          // slice は Node, Deno, Bun で slice をとると CoW でそういう挙動をしてくれる
          this.tentative.set(current, keyword.slice(0, current.depth));
          // あと、これに O(N) かかったとしても、検索時の劣化がなければ別にいい

          current = current.parent!;
        }
      }
    }
  }
}
