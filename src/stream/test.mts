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

// a boundary reads "close the previous word-unit, open the next"; both are zero-width
const open: unique symbol = Symbol();
const close: unique symbol = Symbol();
type Sentinel = typeof open | typeof close;

const withSentinel = (keywords: string[], entry: BoundaryEntry): [string, (string | Sentinel)[]][] => {
  const result: [string, (string | Sentinel)[]][] = [];
  for (const keyword of keywords) {
    if (keyword === '') {
      result.push([keyword, [open, '', close]]);
      continue;
    }

    let output: (string | Sentinel)[] = [keyword[0]];
    for (let i = 1; i < keyword.length; i++) {
      if (entry.boundary(keyword[i - 1], keyword[i - 0])) {
        output.push(close, open);
      }
      output.push(keyword[i]);
    }

    if (entry.target(keyword)) {
      output = [open, ... output, close];
    }

    result.push([ keyword, output ]);
  }

  return result;
}


export class Trie {
  public readonly parent: Trie | null = null;
  public readonly depth: number; // in raw characters: sentinel edges have width 0
  private keyword: string | null = null;
  private goto: Map<string | Sentinel, Trie> = new Map<string | Sentinel, Trie>();

  public constructor(parent?: Trie, width: number = 1) {
    this.parent = parent ?? null;
    this.depth = (parent?.depth ?? -1) + width;
  }

  public can(s: string | Sentinel) {
    return this.goto.has(s);
  }
  public go(s: string | Sentinel) {
    return this.goto.get(s);
  }
  public define(s: string | Sentinel, next: Trie) {
    return this.goto.set(s, next);
  }
  public undef(s: string | Sentinel) {
    this.goto.delete(s);
  }
  public entries() {
    return this.goto.entries();
  }

  public empty() {
    return this.keyword == null;
  }
  public add(k: string) {
    this.keyword = k;
  }
  public value() {
    return this.keyword;
  }
  public merge(t?: Trie) {
    this.keyword ??= t?.keyword ?? null;
  }
}
export abstract class AbstractStreamAhoCorasick {
  protected root = new Trie();
  protected boundaryConfig?: BoundaryEntry;
  protected failure_link = new Map<Trie, Trie>();
  protected readonly maxKeywordLength: number = 0;
  protected readonly maintainLength: number = 0;

  constructor(keywords: string[], boundary?: BoundaryEntry) {
    this.boundaryConfig = boundary;

    // build goto
    if (this.boundaryConfig) {
      for (const [keyword, sequence] of withSentinel(keywords, this.boundaryConfig)) {
        this.maxKeywordLength = Math.max(this.maxKeywordLength, keyword.length);
        let current = this.root;
        for (let i = 0; i < sequence.length; i++) {
          const ch = sequence[i];
          let next = current.go(ch) ?? (new Trie(current, typeof ch === 'string' ? 1 : 0))
          current.define(ch, next);
          current = next;
        }
        current.add(keyword);
      }
    } else {
      for (const keyword of keywords) {
        this.maxKeywordLength = Math.max(this.maxKeywordLength, keyword.length);
        let current = this.root;
        for (let i = 0; i < keyword.length; i++) {
          const ch = keyword[i];
          let next = current.go(ch) ?? (new Trie(current))
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
      const queue: [Trie, (string | Sentinel)][] = [];
      for (const [ch, next] of this.root.entries()) {
        queue.push([next, ch]);
      }
      while (top < queue.length) {
        const data = queue[top++];
        const current = data[0];
        const ch = data[1];
        const parent = current.parent!;

        // calc failure
        // in boundary mode, zero-width suffixes can share their raw begin with the current
        // path, so keyword nodes also need proper failure links (root would drop them)
        if (current.empty() || this.boundaryConfig) {
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
    if (confirmed_index <= this.maintainLength) { return confirmed_index }

    for (const elem of deque) {
      elem.begin -= confirmed_index;
      elem.end -= confirmed_index;
    }
    collector.reposition(confirmed_index);
    return 0;
  }

  private maintainDeque(trie: Trie, deque: Deque<Match>, index: number, offset: number, committed: number): void {
    if (trie.empty()) { return; }

    const keyword = trie.value()!;
    const length = keyword.length;
    const begin = index + offset - length;
    const end = index + offset;

    // a candidate overlapping the already-committed region has lost the arbitration
    if (begin < committed) { return; }

    while (true) {
      if (deque.empty()) {
        deque.addLast({ begin, end, keyword });
        break;
      }

      const last = deque.peekLast()!;
      if (last.end <= begin) {
        deque.addLast({ begin, end, keyword });
        break;
      } else if (begin > last.begin) {
        break;
      } else {
        deque.pollLast();
      }
    }
  }

  // interleave zero-width sentinels into the boundaries of the chunk
  private symbolize(chunk: string, prev: string | null): (string | Sentinel)[] {
    const symbols: (string | Sentinel)[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      if (prev == null) {
        symbols.push(open);
      } else if (this.boundaryConfig!.boundary(prev, ch)) {
        symbols.push(close, open);
      }
      symbols.push(ch);
      prev = ch;
    }
    return symbols;
  }

  protected *processTextSync<T, K>(trie: Trie, deque: Deque<Match>, chunk: string, confirmed_offset: number, committed_offset: number, prev: string | null, collector: Collector, collect: CollectorFunc<T>, detect: DetectFunc<K>): Generator<T | K, [trie: Trie, confirmed_offset: number, committed_offset: number, prev: string | null], unknown> {
    let state = trie;
    let confirmed_index = confirmed_offset;
    let output_begin = committed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    if (this.boundaryConfig == null) {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];

        this.maintainDeque(state, deque, i, remain_offset, output_begin);

        if (!state.can(ch)) { // use failure
          const old_depth = state.depth;
          while (state !== this.root && !(state.can(ch))) {
            state = this.failure_link.get(state)!;
          }
          const new_depth = state.depth;
          confirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
          while (!deque.empty()) {
            const first = deque.peekFirst()!;
            if (first.end > confirmed_index) { break; }

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
      }
    } else {
      const symbols = this.symbolize(chunk, prev);
      prev = chunk.length > 0 ? chunk[chunk.length - 1] : prev;

      let i = 0;
      for (let s = 0; s < symbols.length; s++) {
        const ch = symbols[s];
        const width = typeof ch === 'string' ? 1 : 0;

        this.maintainDeque(state, deque, i, remain_offset, output_begin);

        if (!state.can(ch)) { // use failure
          while (true) {
            const old_depth = state.depth;
            while (state !== this.root && !(state.can(ch))) {
              state = this.failure_link.get(state)!;
            }
            // non-overlap: discard suffixes beginning inside the already-committed region
            while (state !== this.root && (i + remain_offset) - state.depth < output_begin) {
              state = this.failure_link.get(state)!;
            }
            const new_depth = state.depth;
            confirmed_index += (old_depth - new_depth);
            // a pending match is decided once no future candidate can begin at or before its begin
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
            if (state === this.root || (state.can(ch) && (i + remain_offset) - state.depth >= output_begin)) { break; }
          }
          confirmed_index += (state.can(ch) ? 0 : width);
        }
        state = state.go(ch) ?? this.root;
        i += width;
      }
    }

    if (output_begin < confirmed_index) {
      yield* collect(output_begin, confirmed_index);
      output_begin = confirmed_index;
    }
    const maintained = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, maintained, output_begin - (confirmed_index - maintained), prev];
  }
  protected async *processTextAsync<T, K>(trie: Trie, deque: Deque<Match>, chunk: string, confirmed_offset: number, committed_offset: number, prev: string | null, collector: Collector, collect: CollectorFunc<T>, detect: AsyncableDetectFunc<K>): AsyncGenerator<T | K, [trie: Trie, confirmed_offset: number, committed_offset: number, prev: string | null], unknown> {
    let state = trie;
    let confirmed_index = confirmed_offset;
    let output_begin = committed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    if (this.boundaryConfig == null) {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];

        this.maintainDeque(state, deque, i, remain_offset, output_begin);

        if (!state.can(ch)) { // use failure
          const old_depth = state.depth;
          while (state !== this.root && !(state.can(ch))) {
            state = this.failure_link.get(state)!;
          }
          const new_depth = state.depth;
          confirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
          while (!deque.empty()) {
            const first = deque.peekFirst()!;
            if (first.end > confirmed_index) { break; }

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
      }
    } else {
      const symbols = this.symbolize(chunk, prev);
      prev = chunk.length > 0 ? chunk[chunk.length - 1] : prev;

      let i = 0;
      for (let s = 0; s < symbols.length; s++) {
        const ch = symbols[s];
        const width = typeof ch === 'string' ? 1 : 0;

        this.maintainDeque(state, deque, i, remain_offset, output_begin);

        if (!state.can(ch)) { // use failure
          while (true) {
            const old_depth = state.depth;
            while (state !== this.root && !(state.can(ch))) {
              state = this.failure_link.get(state)!;
            }
            // non-overlap: discard suffixes beginning inside the already-committed region
            while (state !== this.root && (i + remain_offset) - state.depth < output_begin) {
              state = this.failure_link.get(state)!;
            }
            const new_depth = state.depth;
            confirmed_index += (old_depth - new_depth);
            // a pending match is decided once no future candidate can begin at or before its begin
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
            if (state === this.root || (state.can(ch) && (i + remain_offset) - state.depth >= output_begin)) { break; }
          }
          confirmed_index += (state.can(ch) ? 0 : width);
        }
        state = state.go(ch) ?? this.root;
        i += width;
      }
    }

    if (output_begin < confirmed_index) {
      yield* collect(output_begin, confirmed_index);
      output_begin = confirmed_index;
    }
    const maintained = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, maintained, output_begin - (confirmed_index - maintained), prev];
  }

  protected *cleanupTextSync<T, K>(trie: Trie, deque: Deque<Match>, confirmed_offset: number, committed_offset: number, prev: string | null, collector: Collector, collect: CollectorFunc<T>, detect: DetectFunc<K>): Iterable<T | K> {
    let state = trie;
    const remain_offset = collector.length;

    // the end of text is also a boundary: close the final word-unit
    if (this.boundaryConfig != null && prev != null) {
      this.maintainDeque(state, deque, 0, remain_offset, committed_offset);
      while (state !== this.root && !(state.can(close))) {
        state = this.failure_link.get(state)!;
      }
      state = state.go(close) ?? this.root;
    }
    this.maintainDeque(state, deque, 0, remain_offset, committed_offset);

    let output_begin = committed_offset;
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
  protected async *cleanupTextAsync<T, K>(trie: Trie, deque: Deque<Match>, confirmed_offset: number, committed_offset: number, prev: string | null, collector: Collector, collect: CollectorFunc<T>, detect: AsyncableDetectFunc<K>): AsyncIterable<T | K> {
    let state = trie;
    const remain_offset = collector.length;

    // the end of text is also a boundary: close the final word-unit
    if (this.boundaryConfig != null && prev != null) {
      this.maintainDeque(state, deque, 0, remain_offset, committed_offset);
      while (state !== this.root && !(state.can(close))) {
        state = this.failure_link.get(state)!;
      }
      state = state.go(close) ?? this.root;
    }
    this.maintainDeque(state, deque, 0, remain_offset, committed_offset);

    let output_begin = committed_offset;
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
  protected tentative = new Map<Trie, string>();

  constructor(keywords: string[]) {
    super(keywords);

    // build tentative
    this.tentative.set(this.root, '')
    for (const keyword of keywords) {
      let current = this.root;
      for (let i = 0; i < keyword.length; i++) {
        const ch = keyword[i];
        let next = current.go(ch) ?? (new Trie(current))
        current.define(ch, next);
        current = next;
      }

      let target = keyword;
      while (!this.tentative.has(current)) {
        if (!current.empty()) {
          target = current.value()!;
        }
        // 本当は string に対する view で範囲を縮めて見れれば一番いいんだけど...
        // slice は Node, Deno, Bun で slice をとると CoW でそういう挙動をしてくれる
        this.tentative.set(current, target.slice(0, current.depth));
        // あと、これに O(N) かかったとしても、検索時の劣化がなければ別にいい

        current = current.parent!;
      }
    }
  }
}
