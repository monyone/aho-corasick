export type Match = { begin: number, end: number, keyword: string };
export type BoundaryFunc = (detect: string, left: string, right: string) => boolean;
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
  private keyword: string | null = null;
  private goto: Map<string, Trie> = new Map<string, Trie>();

  public constructor(parent?: Trie) {
    this.parent = parent ?? null;
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

  constructor(keywords: string[]) {
    // build goto
    for (const keyword of keywords) {
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

  public hasKeywordInText(text: string, boundary?: BoundaryFunc): boolean {
    if (!this.root.empty()) { return true; }

    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {

      const ch = text[i];
      while (!state.can(ch) && state !== this.root) {
        state = this.failure_link.get(state)!;
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) - length;
        const end = (i + 1);

        const l = length === 0 || (boundary == null || handleBoundary(keyword, text[begin - 1], text[begin - 0], boundary));
        const r = length === 0 || (boundary == null || handleBoundary(keyword, text[end - 1], text[end + 0], boundary));
        if (l && r) { return true }
      }
    }

    return false;
  }

  public matchInText(text: string, boundary?: BoundaryFunc): Match[] {
    const candidates: Match[] = [];

    // 初回の "" (empty) がありうるので、そのケースを事前に対応
    if (!this.root.empty()) {
      const keyword = this.root.value()!;
      const length = keyword.length;
      const begin = 0 - length;
      const end = 0;

      candidates.push({ begin, end, keyword })
    }

    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!state.can(ch)) { // use failure
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) - length;
        const end = (i + 1);

        const l = length === 0 || (boundary == null || handleBoundary(keyword, text[begin - 1], text[begin - 0], boundary));
        const r = length === 0 || (boundary == null || handleBoundary(keyword, text[end - 1], text[end + 0], boundary));
        if (l && r) {
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
        }
      }
    }

    return candidates;
  }

  public tokenizeInText<T, K>(text: string, normal: (chunk: string) => T, target: (keyword: string) => K, boundary?: BoundaryFunc): (T | K)[] {
    const tokens: (T | K)[] = [];

    let offset = 0;
    for (const { begin, end, keyword } of this.matchInText(text, boundary)) {
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

  public replaceInText(text: string, replacer: Replacer, boundary?: BoundaryFunc): string {
    const normal = (chunk: string) => chunk;
    const keyword = (detect: string) => handleReplacer(detect, replacer);
    return this.tokenizeInText(text, normal, keyword, boundary).join('');
  }

  public async replaceAsyncInText(text: string, replacer: AsyncableReplacer, boundary?: BoundaryFunc): Promise<string> {
    const normal = (chunk: string) => chunk;
    const keyword = (detect: string) => handleAsyncableReplacer(detect, replacer);
    return (await Promise.all(this.tokenizeInText(text, normal, keyword, boundary))).join('');
  }
}
