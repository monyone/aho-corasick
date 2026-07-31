import Collector from "./collector.mts";
import Deque from "./deque.mts";
import RingBuffer from "./ringbuffer.mts";

export type Match = { begin: number, end: number, keyword: string };

type ReplaceFunc = ((detect: string) => (string | false));
type AsyncableReplaceFunc = ((detect: string) => Promise<ReturnType<ReplaceFunc>> | ReturnType<ReplaceFunc>);
export type Replacer = Record<string, string> | Map<string, string> | ReplaceFunc;
export type AsyncableReplacer = Replacer | AsyncableReplaceFunc;
export type BoundaryFunc = (detect: string, left: string, right: string) => boolean;

const handleReplacer = (detect: string, replacer: Replacer): string => {
  if (replacer instanceof Map) {
    return replacer.get(detect) ?? detect;
  } else if (typeof(replacer) === 'object') {
    if (Object.prototype.hasOwnProperty.call(replacer, detect)) {
      return replacer[detect] ?? detect;
    } else {
      return detect;
    }
  } else {
    const replaced = replacer(detect);
    return replaced !== false ? replaced ?? detect : detect;
  }
};

const handleAsyncableReplacer = (detect: string, replacer: AsyncableReplacer): string | Promise<string> => {
  if (replacer instanceof Map) {
    return replacer.get(detect) ?? detect;
  } else if (typeof(replacer) === 'object') {
    if (Object.prototype.hasOwnProperty.call(replacer, detect)) {
      return replacer[detect] ?? detect;
    } else {
      return detect;
    }
  } else {
    const replaced = replacer(detect);
    if (replaced instanceof Promise) {
      return replaced.then((replaced) => {
        return replaced !== false ? replaced ?? detect: detect;
      });
    } else {
      return replaced !== false ? replaced ?? detect: detect;
    }
  }
};

const handleBoundary = (detect: string, left: string | null, right: string | null, boundary?: BoundaryFunc): boolean => {
  if (left == null || right == null) { return true; }
  return boundary?.(detect, left, right) ?? true;
}

export const Replacer = {
  Keep: () => (() => false),
  Delete: () => (() => ''),
  Mask: (ch: string) => ((str: string) => ch.repeat(str.length)),
  Once: (replacer: Replacer) => {
    const set = new Set<string>();
    return (str: string) => {
      if (set.has(str)) { return false; }
      set.add(str);
      return handleReplacer(str, replacer);
    };
  },
} as const satisfies Record<string, (...args: any[]) => Replacer>;

export const AsyncableReplacer = {
  ... Replacer,
  Once: (replacer: AsyncableReplacer) => {
    const set = new Set<string>();
    return (str: string) => {
      if (set.has(str)) { return false; }
      set.add(str);
      return handleAsyncableReplacer(str, replacer);
    };
  },
} as const satisfies Record<string, (...args: any[]) => AsyncableReplacer>;

export const Boundary = {
  WhiteSpace: (): BoundaryFunc => {
    const isBoundary = (ch: string) => /\s/.test(ch);
    return (_, left, right) => isBoundary(left) || isBoundary(right);
  },
  AsciiTerm: (prefill?: string[]): BoundaryFunc => {
    const isAsciiChar = (ch: string) => /[A-Za-z0-9_&#+.-]/.test(ch);
    const isAsciiTerm = (term: string) => /^[A-Za-z0-9_&#+.-](?:[A-Za-z0-9_&#+.\s-]*[A-Za-z0-9_&#+.-])?$/.test(term);
    const isAsciiTermCache = new Map<string, boolean>(
      (prefill ?? []).map((keyword) => [keyword, isAsciiTerm(keyword)])
    );
    return (detect, left, right) => {
      const asciiTermCache = isAsciiTermCache.get(detect);
      if (asciiTermCache === false) { return true; }
      const asciiTerm = asciiTermCache ?? isAsciiTerm(detect);
      if (!isAsciiTermCache.has(detect)) {
        isAsciiTermCache.set(detect, asciiTerm);
      }
      if (!asciiTerm) { return true; }
      return !(isAsciiChar(left) && isAsciiChar(right));
    };
  },
  AsciiEdge: (): BoundaryFunc => {
    const isAsciiChar = (ch: string) => /[A-Za-z0-9_&#+.-]/.test(ch);
    return (_, left, right) => {
      return !(isAsciiChar(left) && isAsciiChar(right));
    };
  },
  By: (separator: RegExp): BoundaryFunc => {
    return (_, left, right) => separator.test(left) || separator.test(right);
  },
} as const satisfies Record<string, (...args: any[]) => BoundaryFunc>;

class Trie {
  public readonly parent: Trie | null = null;
  public readonly depth: number;
  private keyword: string | null = null;
  private goto: Map<string, Trie> = new Map<string, Trie>();

  public constructor(parent?: Trie) {
    this.parent = parent ?? null;
    this.depth = (parent?.depth ?? -1) + 1;
  }

  public can(s: string) {
    return this.goto.has(s);
  }
  public go(s: string) {
    return this.goto.get(s);
  }
  public define(s: string, next: Trie) {
    return this.goto.set(s, next);
  }
  public undef(s: string) {
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
  public delete(k: string) {
    this.keyword = null;
  }
  public value() {
    return this.keyword;
  }
  public merge(t?: Trie) {
    this.keyword ??= t?.keyword ?? null;
  }
}
export class AhoCorasick {
  protected root = new Trie();
  protected failure_link = new Map<Trie, Trie>();
  protected readonly maxKeywordLength: number = 0;
  protected readonly maintainLength: number = 0;
  protected readonly ringbufferCapacity: number = 0;

  constructor(keywords: string[]) {
    // build goto
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
    this.maintainLength = this.maxKeywordLength * 2;
    this.ringbufferCapacity = this.maintainLength + 2;

    // build failure
    {
      let top = 0;
      const queue: [Trie, string][] = [];
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

  public *matchInText(text: string): Iterable<Match> {
    const deque = new Deque<Match>();

    let confirmed_index = 0;
    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
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
          yield deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) - length;
        const end = (i + 1);

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
    }

    while (!deque.empty()) {
      yield deque.pollFirst()!;
    }
  }

  private maintainAmortization(deque: Deque<Match>, ring: RingBuffer<string>, collector: Collector, confirmed_index: number): number {
    if (confirmed_index <= this.maintainLength) { return confirmed_index }

    for (const elem of deque) {
      elem.begin -= confirmed_index;
      elem.end -= confirmed_index;
    }
    collector.reposition(confirmed_index);
    ring.reposition(confirmed_index);
    return 0;
  }

  private maintainDeque(trie: Trie, deque: Deque<Match>, ring: RingBuffer<string>, index: number, offset: number, boundary?: BoundaryFunc): void {
    if (trie.empty()) { return; }

    const keyword = trie.value()!;
    const length = keyword.length;
    const begin = index + offset - length;
    const end = index + offset;

    const l = length === 0 || (boundary == null || handleBoundary(keyword, ring.get(begin - 1), ring.get(begin - 0), boundary));
    const r = length === 0 || (boundary == null || handleBoundary(keyword, ring.get(end - 1), ring.get(end + 0), boundary));
    if (!l || !r) { return; }

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

  protected *replaceProcessTextSync(trie: Trie, deque: Deque<Match>, ring: RingBuffer<string>, chunk: string, confirmed_offset: number, collector: Collector, replacer: Replacer, boundary?: BoundaryFunc): Generator<string, [trie: Trie, confirmed_offset: number], unknown> {
    let state = trie;
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      ring.push(ch);

      this.maintainDeque(state, deque, ring, i, remain_offset, boundary);

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
            yield* collector.take(first.begin - output_begin);
          }
          collector.skip(first.end - first.begin);
          yield handleReplacer(first.keyword, replacer);
          output_begin = first.end;

          deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;
    }

    if (output_begin < confirmed_index) {
      yield* collector.take(confirmed_index - output_begin);
    }
    confirmed_offset = this.maintainAmortization(deque, ring, collector, confirmed_index);
    return [state, confirmed_offset];
  }
  protected async *replaceProcessTextAsync(trie: Trie, deque: Deque<Match>, ring: RingBuffer<string>, chunk: string, confirmed_offset: number, collector: Collector, replacer: AsyncableReplacer, boundary?: BoundaryFunc): AsyncGenerator<string, [trie: Trie, confirmed_offset: number], unknown> {
    let state = trie;
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
      ring.push(ch);

      this.maintainDeque(state, deque, ring, i, remain_offset, boundary);

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
            yield* collector.take(first.begin - output_begin);
          }
          {
            collector.skip(first.end - first.begin);
            const replaced = handleAsyncableReplacer(first.keyword, replacer);
            yield !(replaced instanceof Promise) ? replaced : await replaced;
          }
          output_begin = first.end;

          deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;
    }

    if (output_begin < confirmed_index) {
      yield* collector.take(confirmed_index - output_begin);
    }
    confirmed_offset = this.maintainAmortization(deque, ring, collector, confirmed_index);
    return [state, confirmed_offset];
  }

  protected *replaceCleanupTextSync(trie: Trie, deque: Deque<Match>, ring: RingBuffer<string>, confirmed_offset: number, collector: Collector, replacer: Replacer, boundary?: BoundaryFunc): Iterable<string> {
    const state = trie;
    const remain_offset = collector.length;
    this.maintainDeque(state, deque, ring, 0, remain_offset, boundary);

    let output_begin = confirmed_offset;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield* collector.take(first.begin - output_begin);
      }
      collector.skip(first.end - first.begin);
      yield handleReplacer(first.keyword, replacer);

      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      yield* collector.take(collector.length - output_begin);
    }
  }
  protected async *replaceCleanupTextAsync(trie: Trie, deque: Deque<Match>, ring: RingBuffer<string>, confirmed_offset: number, collector: Collector, replacer: AsyncableReplacer, boundary?: BoundaryFunc): AsyncIterable<string> {
    const state = trie;
    const remain_offset = collector.length;
    this.maintainDeque(state, deque, ring, 0, remain_offset, boundary);

    let output_begin = confirmed_offset;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield* collector.take(first.begin - output_begin);
      }
      {
        collector.skip(first.end - first.begin);
        const replaced = handleAsyncableReplacer(first.keyword, replacer);
        yield !(replaced instanceof Promise) ? replaced : await replaced;
      }
      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      yield* collector.take(collector.length - output_begin);
    }
  }

  public *replaceSync(iterable: Iterable<string>, replacer: Replacer, boundary?: BoundaryFunc): Iterable<string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);

    let state: Trie = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    for (const text of iterable) {
      [state, confirmed_offset] = yield* this.replaceProcessTextSync(state, deque, ring, text, confirmed_offset, collector, replacer, boundary);
    }
    yield* this.replaceCleanupTextSync(state, deque, ring, confirmed_offset, collector, replacer, boundary);
  }

  public async *replaceAsync(iterable: AsyncIterable<string>, replacer: Replacer, boundary?: BoundaryFunc): AsyncIterable<string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);

    let state: Trie = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, confirmed_offset] = yield* this.replaceProcessTextSync(state, deque, ring, text, confirmed_offset, collector, replacer, boundary);
    }
    yield* this.replaceCleanupTextSync(state, deque, ring, confirmed_offset, collector, replacer, boundary);
  }

  public async *replaceAsyncToMaybePromise(iterable: AsyncIterable<string>, replacer: AsyncableReplacer, boundary?: BoundaryFunc): AsyncIterable<string> {
    const deque = new Deque<Match>();
    const ring = new RingBuffer<string>(this.ringbufferCapacity);

    let state: Trie = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, confirmed_offset] = yield* this.replaceProcessTextAsync(state, deque, ring, text, confirmed_offset, collector, replacer, boundary);
    }
    yield* this.replaceCleanupTextAsync(state, deque, ring, confirmed_offset, collector, replacer, boundary);
  }
}

