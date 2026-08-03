export type Match = { begin: number, end: number, keyword: string };
export type BoundaryTarget = (keyword: string) => boolean;
export type BoundaryFunc = (left: string, right: string) => boolean;
type ReplaceFunc = ((detect: string) => (string | false));
type AsyncableReplaceFunc = ((detect: string) => Promise<ReturnType<ReplaceFunc>> | ReturnType<ReplaceFunc>);
export type Replacer = Record<string, string> | Map<string, string> | ReplaceFunc;
export type AsyncableReplacer = Replacer | AsyncableReplaceFunc;

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

export class AhoCorasick {
  protected readonly boundaryConfig?: BoundaryEntry;
  protected root = new Trie<Sym, string>();
  protected failure_link = new Map<Trie<Sym, string>, Trie<Sym, string>>();

  constructor(keywords: string[], boundary?: BoundaryEntry) {
    this.boundaryConfig = boundary;

    // build goto
    for (const keyword of keywords) {
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

  private symbolize(text: string): Sym[] {
    if (this.boundaryConfig == null) { return text.split(''); }
    const syms: Sym[] = [];

    for (let i = 0; i < text.length; i++) {
      if (i === 0) {
        syms.push(OPEN);
      } else if (this.boundaryConfig.boundary(text[i - 1], text[i - 0])) {
        syms.push(CLOSE, OPEN);
      }
      syms.push(text[i]);
    }
    // テキスト終端も境界: 末尾で終わる target キーワードを完成させる
    if (text.length > 0) { syms.push(CLOSE); }
    return syms;
  }

  public hasKeywordInText(text: string): boolean {
    if (!this.root.empty()) { return true; }

    let state = this.root;
    const symbols = this.symbolize(text);
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      while (!state.can(ch) && state !== this.root) {
        state = this.failure_link.get(state)!;
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) { return true; }
    }

    return false;
  }

  public matchInText(text: string): Match[] {
    const candidates: Match[] = [];
    const push = (begin: number, end: number, keyword: string) => {
      while (true) {
        if (candidates.length === 0) {
          candidates.push({ begin, end, keyword })
          break;
        }

        const stack = candidates.length - 1;
        if (candidates[stack].end <= begin && candidates[stack].begin < begin) {
          candidates.push({ begin, end, keyword });
          break;
        } else if (begin > candidates[stack].begin) {
          break;
        } else {
          candidates.pop();
        }
      }
    };

    // "" (empty) がありうるので、そのケースを対応
    if (!this.root.empty()) {
      const keyword = this.root.value()!;
      const length = keyword.length;
      const begin = 0 - length;
      const end = 0;
      candidates.push({ begin, end, keyword })
    }

    let state = this.root;
    let index = 0;
    const symbols = this.symbolize(text);
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      const width = typeof(ch) === 'string' ? 1 : 0;

      // "" (empty) がありうるので、そのケースを対応
      if (!this.root.empty() && width > 0) {
        const keyword = this.root.value()!;
        const length = keyword.length;
        const end = index;
        const begin = end - length;
        push(begin, end, keyword);
      }

      if (!state.can(ch)) { // use failure
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const end = index + width;
        const begin = end - length;
        push(begin, end, keyword);
      }

      index += width;
    }

    // "" (empty) がありうるので、そのケースを対応
    if (!this.root.empty()) {
      const keyword = this.root.value()!;
      const length = keyword.length;
      const end = index;
      const begin = end - length;
      push(begin, end, keyword);
    }

    return candidates;
  }

  public tokenizeInText<T, K>(text: string, normal: (chunk: string) => T, target: (keyword: string) => K): (T | K)[] {
    const tokens: (T | K)[] = [];

    let offset = 0;
    for (const { begin, end, keyword } of this.matchInText(text)) {
      if (offset < begin) {
        tokens.push(normal(text.slice(offset, begin)));
      }
      tokens.push(target(keyword));
      offset = end;
    }
    if (offset < text.length) {
      tokens.push(normal(text.slice(offset, text.length)));
    }

    return tokens;
  }

  public replaceInText(text: string, replacer: Replacer): string {
    const normal = (chunk: string) => chunk;
    const keyword = (detect: string) => handleReplacer(detect, replacer);
    return this.tokenizeInText(text, normal, keyword).join('');
  }

  public async replaceAsyncInText(text: string, replacer: AsyncableReplacer): Promise<string> {
    const normal = (chunk: string) => chunk;
    const keyword = (detect: string) => handleAsyncableReplacer(detect, replacer);
    return (await Promise.all(this.tokenizeInText(text, normal, keyword))).join('');
  }
}
