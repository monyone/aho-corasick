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
    const cls = isAsciiChars.replace(/[\\\]^-]/g, "\\$&");
    const pattern = new RegExp(`^[${cls}](?:[${cls}\\s]*[${cls}])?$`);
    const target = (t: string) => pattern.test(t);
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

class Trie {
  public readonly parent: Trie | null = null;
  private goto: Map<number, Trie> = new Map<number, Trie>();

  public constructor(parent?: Trie) {
    this.parent = parent ?? null;
  }

  public has(s: number): boolean {
    return this.goto.has(s);
  }

  public set(s: number, next: Trie) {
    return this.goto.set(s, next);
  }

  public go(s: number) {
    return this.goto.get(s);
  }

  public keys(): Iterable<number> {
    return this.goto.keys();
  }
}

class DoubleArray {
  private code: Map<Sym, number>;
  private head = 1;
  private tail = 1;
  private base: number[] = [0, -2];
  private check: number[] = [0, -2];
  private failure: number[] = [-1, -1];
  private keyword: (string | null)[] = [null, null];

  public constructor(keywords: string[], entry?: BoundaryEntry) {
    const set = new Set<Sym>();
    if (entry) {
      set.add(OPEN);
      set.add(CLOSE);
    }
    for (const keyword of keywords) {
      for (let i = 0; i < keyword.length; i++) {
        const character = keyword[i];
        set.add(character);
      }
    }
    this.code = new Map<Sym, number>(Array.from(set.values()).map((v, i) => [v, i + 1]));
    const unique = new Set<string>();
    const total: Sym[][] = [];
    for (const keyword of keywords) {
      if (unique.has(keyword)) { continue; }
      unique.add(keyword);
      for (const sequence of withSentinel(keyword, entry)) {
        total.push(sequence);
      }
    }
    const words = total.map((syms) => syms.map((sym) => this.code.get(sym)!));

    // construct Trie
    const root = new Trie();
    for (const word of words) {
      let node = root;
      for (const character of word) {
        if (!node.has(character)) {
          node.set(character, new Trie(node));
        }
        node = node.go(character)!;
      }
    }

    // construct Double Array
    {
      let top = 0;
      const queue: [number, Trie][] = [[0, root]];
      let offset_hint = this.head;
      while (top < queue.length) {
        const [node, trie] = queue[top++];
        const leafs = Array.from(trie.keys());
        const max_leaf = leafs.reduce((a, b) => Math.max(a, b), 0);

        let offset = offset_hint;
        let free_count = 1;
        LOOP:
        while (true) {
          for (const leaf of leafs) {
            const next = offset + leaf;
            if (next < this.check.length && this.check[next] >= 0) {
              // we must keep empty node in last element, loop must be finite
              offset = -(this.check[offset] + 1);
              free_count += 1;
              continue LOOP;
            }
          }

          break;
        }

        // register node
        this.base[node] = offset - node;
        // register hint (20 = 95% filled)
        if (free_count * 20 <= (offset - offset_hint)) {
          offset_hint = offset;
        }
        // reserve node
        const max = offset + max_leaf + 1 /* keep empty node */;
        for (let i = this.base.length; i <= max; i++) {
          this.check.push(-(this.head + 1)); // next
          this.base.push(-(this.tail + 1)); // prev

          this.check[this.tail] = -(i + 1);
          this.tail = i;
          this.base[this.head] = -(this.tail + 1);

          this.keyword.push(null);
          this.failure.push(-1);
        }
        // use child element
        for (const leaf of leafs) {
          const next = offset + leaf;
          const free_next = -(this.check[next] + 1);
          const free_prev = -(this.base[next] + 1);

          if (this.head === next) { this.head = free_next; }
          if (this.tail === next) { this.tail = free_prev; }

          this.base[free_next] = this.base[next];
          this.check[free_prev] = this.check[next];
        }

        // BFS
        for (const leaf of leafs) {
          const next = offset + leaf;
          this.check[next] = node;
          queue.push([next, trie.go(leaf)!]);
        }
      }
    }
    // Register Keyword
    {
      for (const keyword of unique) {
        for (const sequence of withSentinel(keyword, entry)) {
          let node = 0;
          for (let i = 0; i < sequence.length; i++) {
            node += this.base[node] + this.code.get(sequence[i])!;
          }
          this.keyword[node] = keyword;
        }
      }
    }
    // Build Failure
    {
      let top = 0;
      const queue: [number, Trie][] = [[0, root]];
      while (top < queue.length) {
        const [parent, trie] = queue[top++]!;
        const leafs = Array.from(trie.keys());

        for (const leaf of leafs) {
          const node = parent + this.base[parent] + leaf;
          if (this.keyword[node] == null) {
            let failure = this.failure[parent];
            while (failure >= 0 && this.check[(failure + this.base[failure] + leaf)] !== failure) {
              failure = this.failure[failure];
            }
            const next = failure < 0 ? -1 : (failure + this.base[failure] + leaf);
            this.failure[node] = next < 0 ? 0 : this.check[next] !== failure ? 0 : next;
            this.keyword[node] = this.keyword[this.failure[node]];
          } else {
            this.failure[node] = 0;
          }

          queue.push([node, trie.go(leaf)!]);
        }
      }
    }
  }

  public go(node: number, character: Sym): number {
    const code = this.code.get(character);
    if (code == null) { return 0; }

    while (node >= 0) {
      const next = node + this.base[node] + code;
      if (this.check[next] === node) { return next; }
      node = this.failure[node];
    }
    return Math.max(node, 0);
  }

  public query(node: number): string | null {
    return this.keyword[node];
  }
}

export class AhoCorasick {
  private readonly boundaryConfig?: BoundaryEntry;
  private trie: DoubleArray;

  constructor(keywords: string[], boundary?: BoundaryEntry) {
    this.trie = new DoubleArray(keywords, boundary);
    this.boundaryConfig = boundary;
  }

  public hasKeywordInText(text: string): boolean {
    const root = 0;
    if (this.trie.query(root) != null) { return true; }

    let node = root;
    let prev: string | null = null;
    for (let i = 0; i <= text.length; i++) {
      const char = text[i];
      let sentinel: Sentinel | null = null;
      if (this.boundaryConfig != null) {
        if (prev == null) { sentinel = OPEN; }
        else if (this.boundaryConfig.boundary(prev, char)) { sentinel = CLOSE; }
      }

      LOOP:
      while (true) {
        const ch: Sym = sentinel ?? char;
        node = this.trie.go(node, ch);

        const keyword = this.trie.query(node);
        if (keyword != null) { return true; }

        if (i === text.length - 1 && sentinel == null) {
          sentinel = CLOSE;
          i += 1;
          continue LOOP;
        } else if (i >= text.length) {
          break LOOP;
        }
        switch (sentinel) {
          case CLOSE: sentinel = OPEN; break;
          case OPEN: sentinel = null; break;
          case null: break LOOP;
        }
      }

      prev = char;
    }

    return false;
  }

  public matchInText(text: string): Match[] {
    const root = 0;
    const candidates: Match[] = [];
    const push = (begin: number, end: number, keyword: string) => {
      while (true) {
        if (candidates.length === 0) {
          candidates.push({ begin, end, keyword });
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
    {
      const keyword = this.trie.query(root);
      if (keyword != null) {
        const length = keyword.length;
        const begin = 0 - length;
        const end = 0;
        candidates.push({ begin, end, keyword });
      }
    }

    let node = root;
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
        {
          const keyword = this.trie.query(root);
          if (keyword != null) {
            const length = keyword.length;
            const end = i;
            const begin = end - length;
            push(begin, end, keyword);
          }
        }

        node = this.trie.go(node, ch);
        {
          const keyword = this.trie.query(node);
          if (keyword != null) {
            const length = keyword.length;
            const end = i + width;
            const begin = end - length;
            push(begin, end, keyword);
          }
        }

        if (this.boundaryConfig != null) {
          if (i === text.length - 1 && sentinel == null) {
            sentinel = CLOSE;
            i += 1;
            continue LOOP;
          } else if (i >= text.length) {
            break LOOP;
          }
        }
        switch (sentinel) {
          case CLOSE: sentinel = OPEN; break;
          case OPEN: sentinel = null; break;
          case null: break LOOP;
        }
      }
      prev = char;
    }

    // "" (empty) がありうるので、そのケースを対応
    {
      const keyword = this.trie.query(root);
      if (keyword != null) {
        const length = keyword.length;
        const end = text.length;
        const begin = end - length;
        push(begin, end, keyword);
      }
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
