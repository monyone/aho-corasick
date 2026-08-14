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
type Sym = string | Sentinel;

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

export class Trie<T, K> {
  public readonly parent: Trie<T, K> | null = null;
  public readonly depth: number;
  private keyword: K | null = null;
  private goto: Map<T, Trie<T, K>> = new Map<T, Trie<T, K>>();
  public failure: Trie<T, K> | null = null;

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

  public hasKeywordInText(text: string): boolean {
    if (!this.root.empty()) { return true; }

    let state = this.root;
    let prev: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      let sentinel: Sentinel | null = null;
      if (this.boundaryConfig != null) {
        if (prev == null) { sentinel = OPEN; }
        else if (this.boundaryConfig.boundary(prev, char)) { sentinel = CLOSE; }
      }

      LOOP:
      while (true) {
        const ch: Sym = sentinel ?? char;

        while (!state.can(ch) && state !== this.root) {
          state = state.failure!;
        }
        state = state.go(ch) ?? this.root;

        if (!state.empty()) { return true; }
        switch (sentinel) {
          case CLOSE: sentinel = OPEN; break;
          case OPEN: sentinel = null; break;
          case null: break LOOP;
        }
      }

      prev = char;
    }

    // boundary がある場合は 最後に CLOSE を入れる
    // text長が 0 の場合は上記のループで入らない OPEN も入れる
    if (this.boundaryConfig != null) {
      let sentinel: Sentinel = CLOSE;
      if (prev == null) { sentinel = OPEN; }

      LOOP:
      while (true) {
        const sym: Sym = sentinel;

        while (!state.can(sym) && state !== this.root) {
          state = state.failure!;
        }
        state = state.go(sym) ?? this.root;

        if (!state.empty()) { return true; }

        switch (sentinel) {
          case CLOSE: break LOOP;
          case OPEN: sentinel = CLOSE; break;
        }
      }
    }

    return !this.root.empty();
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
    let prev: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      let sentinel: Sentinel | null = null;
      if (this.boundaryConfig != null) {
        if (prev == null) { sentinel = OPEN; }
        else if (this.boundaryConfig.boundary(prev, char)) { sentinel = CLOSE; }
      }

      LOOP:
      while (true) {
        const ch: Sym = sentinel ?? char;
        const width = typeof(ch) === 'string' ? 1 : 0;

        // "" (empty) がありうるので、そのケースを対応
        if (!this.root.empty()) {
          const keyword = this.root.value()!;
          const length = keyword.length;
          const end = i;
          const begin = end - length;
          push(begin, end, keyword);
        }

        if (!state.can(ch)) { // use failure
          while (state !== this.root && !(state.can(ch))) {
            state = state.failure!;
          }
        }
        state = state.go(ch) ?? this.root;

        if (!state.empty()) {
          const keyword = state.value()!;
          const length = keyword.length;
          const end = i + width;
          const begin = end - length;
          push(begin, end, keyword);
        }

        switch (sentinel) {
          case CLOSE: sentinel = OPEN; break;
          case OPEN: sentinel = null; break;
          case null: break LOOP;
        }
      }
      prev = char;
    }

    // boundary がある場合は 最後に CLOSE を入れる
    // text長が 0 の場合は上記のループで入らない OPEN も入れる
    if (this.boundaryConfig != null) {
      let sentinel: Sentinel = CLOSE;
      if (prev == null) { sentinel = OPEN; }

      LOOP:
      while (true) {
        const sym: Sym = sentinel;
        const width = 0;

        while (!state.can(sym) && state !== this.root) {
          state = state.failure!;
        }
        state = state.go(sym) ?? this.root;

        if (!state.empty()) {
          const keyword = state.value()!;
          const length = keyword.length;
          const end = (text.length) + width;
          const begin = end - length;
          push(begin, end, keyword);
        }

        switch (sentinel) {
          case CLOSE: break LOOP;
          case OPEN: sentinel = CLOSE; break;
        }
      }
    }

    // "" (empty) がありうるので、そのケースを対応
    if (!this.root.empty()) {
      const keyword = this.root.value()!;
      const length = keyword.length;
      const end = text.length;
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

  /** @deprecated */
  public async replaceAsyncInText(text: string, replacer: AsyncableReplacer): Promise<string> {
    const normal = (chunk: string) => chunk;
    const keyword = (detect: string) => handleAsyncableReplacer(detect, replacer);
    return (await Promise.all(this.tokenizeInText(text, normal, keyword))).join('');
  }
}
