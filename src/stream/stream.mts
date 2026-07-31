import Collector from "./collector.mts";
import Deque from "./deque.mts";

export type Match = { begin: number, end: number, keyword: string };

type ReplaceFunc = ((detect: string, left?: string, right?: string) => (string | false));
type AsyncableReplaceFunc = ((detect: string, left?: string, right?: string) => Promise<ReturnType<ReplaceFunc>> | ReturnType<ReplaceFunc>);
export type Replacer = Record<string, string> | Map<string, string> | ReplaceFunc;
export type AsyncableReplacer = Replacer | AsyncableReplaceFunc;
export type BoundaryFunc = (detect: string, left: string | null, right: string | null) => boolean;

export const Boundary = {
  WhiteSpace: (): BoundaryFunc => {
    const isBoundary = (ch: string | null) => ch == null || /\s/.test(ch);
    return (_, left, right) => isBoundary(left) && isBoundary(right);
  },
  AsciiTerm: (): BoundaryFunc => {
    const isAsciiChar = (ch: string) => /[A-Za-z0-9_&#+.-]/.test(ch);
    const isAsciiTerm = (ch: string) => /^[A-Za-z0-9_&#+.-]+$/.test(ch);
    const isBoundary = (ch: string | null) => ch == null || !isAsciiChar(ch);
    return (detect, left, right) => {
      if (!isAsciiTerm(detect)) { return true; }
      if (isBoundary(left) && isBoundary(right)) { return true; }
      return false;
    };
  },
  By: (separator: RegExp): BoundaryFunc => {
    const isBoundary = (ch: string | null) => ch == null || separator.test(ch);
    return (_, left, right) => isBoundary(left) && isBoundary(right);
  },
} as const satisfies Record<string, (...args: any[]) => BoundaryFunc>;

const handleReplacer = (detect: string, left: string | null, right: string | null, replacer: Replacer): string => {
  if (replacer instanceof Map) {
    return replacer.get(detect) ?? detect;
  } else if (typeof(replacer) === 'object') {
    if (Object.prototype.hasOwnProperty.call(replacer, detect)) {
      return replacer[detect] ?? detect;
    } else {
      return detect;
    }
  } else {
    const replaced = replacer(detect, left ?? undefined, right ?? undefined);
    return replaced !== false ? replaced ?? detect : detect;
  }
};

const handleAsyncableReplacer = (detect: string, left: string | null, right: string | null, replacer: AsyncableReplacer): string | Promise<string> => {
  if (replacer instanceof Map) {
    return replacer.get(detect) ?? detect;
  } else if (typeof(replacer) === 'object') {
    if (Object.prototype.hasOwnProperty.call(replacer, detect)) {
      return replacer[detect] ?? detect;
    } else {
      return detect;
    }
  } else {
    const replaced = replacer(detect, left ?? undefined, right ?? undefined);
    if (replaced instanceof Promise) {
      return replaced.then((replaced) => {
        return replaced !== false ? replaced ?? detect: detect;
      });
    } else {
      return replaced !== false ? replaced ?? detect: detect;
    }
  }
};

export const Replacer = {
  Keep: () => (() => false),
  Delete: () => (() => ''),
  Mask: (ch: string) => ((str: string) => ch.repeat(str.length)),
  WithBoundary: (boundary: BoundaryFunc, replacer: Replacer) => {
    return (str: string, left?: string, right?: string) => {
      if (!boundary(str, left ?? null, right ?? null)) { return false;}
      return handleReplacer(str, left ?? null, right ?? null, replacer);
    }
  },
  Once: (replacer: Replacer) => {
    const set = new Set<string>();
    return (str: string, left?: string, right?: string) => {
      if (set.has(str)) { return false; }
      set.add(str);
      return handleReplacer(str, left ?? null, right ?? null, replacer);
    };
  },
} as const satisfies Record<string, (...args: any[]) => Replacer>;

export const AsyncableReplacer = {
  ... Replacer,
  WithBoundary: (boundary: BoundaryFunc, replacer: AsyncableReplacer) => {
    return (str: string, left?: string, right?: string) => {
      if (!boundary(str, left ?? null, right ?? null)) { return false;}
      return handleAsyncableReplacer(str, left ?? null, right ?? null, replacer);
    }
  },
  Once: (replacer: AsyncableReplacer) => {
    const set = new Set<string>();
    return (str: string, left?: string, right?: string) => {
      if (set.has(str)) { return false; }
      set.add(str);
      return handleAsyncableReplacer(str, left ?? null, right ?? null, replacer);
    };
  },
} as const satisfies Record<string, (...args: any[]) => AsyncableReplacer>;

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

  private maintainAmortization(deque: Deque<Match>, collector: Collector, confirmed_index: number): number {
    // 一応 2 倍にしておく (空文字と普通の文字が入るケースを今後入れたい)
    if (confirmed_index <= 2 * this.maxKeywordLength) { return confirmed_index }

    for (const elem of deque) {
      elem.begin -= confirmed_index;
      elem.end -= confirmed_index;
    }
    collector.reposition(confirmed_index);
    return 0;
  }

  protected *replaceProcessTextSync(trie: Trie, deque: Deque<Match>, chunk: string, confirmed_offset: number, collector: Collector, replacer: Replacer): Generator<string, [trie: Trie, confirmed_offset: number], unknown> {
    let state = trie;
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
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
          const left = collector.tail();
          collector.skip(first.end - first.begin);
          const right = collector.peek();
          yield handleReplacer(first.keyword, left, right, replacer);
          output_begin = first.end;

          deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) + remain_offset - length;
        const end = (i + 1) + remain_offset;

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

    if (output_begin < confirmed_index) {
      yield* collector.take(confirmed_index - output_begin);
    }
    confirmed_offset = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, confirmed_offset];
  }
  protected async *replaceProcessTextAsync(trie: Trie, deque: Deque<Match>, chunk: string, confirmed_offset: number, collector: Collector, replacer: AsyncableReplacer): AsyncGenerator<string, [trie: Trie, confirmed_offset: number], unknown> {
    let state = trie;
    let confirmed_index = confirmed_offset;
    let output_begin = confirmed_offset;
    const remain_offset = collector.length;
    collector.feed(chunk);

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];
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
            const left = collector.tail();
            collector.skip(first.end - first.begin);
            const right = collector.peek();
            const replaced = handleAsyncableReplacer(first.keyword, left, right, replacer);
            yield !(replaced instanceof Promise) ? replaced : await replaced;
          }
          output_begin = first.end;

          deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) + remain_offset - length;
        const end = (i + 1) + remain_offset;

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

    if (output_begin < confirmed_index) {
      yield* collector.take(confirmed_index - output_begin);
    }
    confirmed_offset = this.maintainAmortization(deque, collector, confirmed_index);
    return [state, confirmed_offset];
  }

  protected *replaceCleanupTextSync(deque: Deque<Match>, confirmed_offset: number, collector: Collector, replacer: Replacer): Iterable<string> {
    let output_begin = confirmed_offset;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield* collector.take(first.begin - output_begin);
      }
      const left = collector.tail();
      collector.skip(first.end - first.begin);
      const right = collector.peek();
      yield handleReplacer(first.keyword, left, right, replacer);

      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      yield* collector.take(collector.length - output_begin);
    }
  }
  protected async *replaceCleanupTextAsync(deque: Deque<Match>, confirmed_offset: number, collector: Collector, replacer: AsyncableReplacer): AsyncIterable<string> {
    let output_begin = confirmed_offset;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield* collector.take(first.begin - output_begin);
      }
      {
        const left = collector.tail();
        collector.skip(first.end - first.begin);
        const right = collector.peek();
        const replaced = handleAsyncableReplacer(first.keyword, left, right, replacer);
        yield !(replaced instanceof Promise) ? replaced : await replaced;
      }
      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < collector.length) {
      yield* collector.take(collector.length - output_begin);
    }
  }

  public *replaceSync(iterable: Iterable<string>, replacer: Replacer): Iterable<string> {
    const deque = new Deque<Match>();

    let state: Trie = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    for (const text of iterable) {
      [state, confirmed_offset] = yield* this.replaceProcessTextSync(state, deque, text, confirmed_offset, collector, replacer);
    }
    yield* this.replaceCleanupTextSync(deque, confirmed_offset, collector, replacer);
  }

  public async *replaceAsync(iterable: AsyncIterable<string>, replacer: Replacer): AsyncIterable<string> {
    const deque = new Deque<Match>();

    let state: Trie = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, confirmed_offset] = yield* this.replaceProcessTextSync(state, deque, text, confirmed_offset, collector, replacer);
    }
    yield* this.replaceCleanupTextSync(deque, confirmed_offset, collector, replacer);
  }

  public async *replaceAsyncToMaybePromise(iterable: AsyncIterable<string>, replacer: AsyncableReplacer): AsyncIterable<string> {
    const deque = new Deque<Match>();

    let state: Trie = this.root;
    const collector = new Collector();
    let confirmed_offset = 0;

    for await (const text of iterable) {
      [state, confirmed_offset] = yield* this.replaceProcessTextAsync(state, deque, text, confirmed_offset, collector, replacer);
    }
    yield* this.replaceCleanupTextAsync(deque, confirmed_offset, collector, replacer);
  }
}

