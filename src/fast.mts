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
  private code: Map<string, number>;
  private head = 1;
  private tail = 1;
  private base: number[] = [0, -2];
  private check: number[] = [0, -2];
  private failure: number[] = [-1, -1];
  private keywords: (string[] | null)[] = [null, null];

  public constructor(keywords: string[]) {
    const set = new Set<string>();
    for (const keyword of keywords) {
      for (let i = 0; i < keyword.length; i++) {
        const character = keyword[i];
        set.add(character);
      }
    }
    this.code = new Map<string, number>(Array.from(set.values()).map((v, i) => [v, i + 1]));
    const unique = new Set(keywords);
    const words = Array.from(unique.values()).map((keyword) => keyword.split('').map((character) => this.code.get(character)!));

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
      while (top < queue.length) {
        const [node, trie] = queue[top++];
        const leafs = Array.from(trie.keys());
        const max_leaf = leafs.reduce((a, b) => Math.max(a, b), 0);

        let offset = this.head;
        LOOP:
        while (true) {
          for (const leaf of leafs) {
            const next = offset + leaf;
            if (next < this.check.length && this.check[next] >= 0) {
              // we must keep empty node in last element, loop must be finite
              offset = -(this.check[offset] + 1);
              continue LOOP;
            }
          }

          break;
        }

        // register node
        this.base[node] = offset - node;
        // reserve node
        const max = offset + max_leaf + 1 /* keep empty node */;
        for (let i = this.base.length; i <= max; i++) {
          this.check.push(-(this.head + 1)); // next
          this.base.push(-(this.tail + 1)); // prev

          this.check[this.tail] = -(i + 1);
          this.tail = i;
          this.base[this.head] = -(this.tail + 1);

          this.keywords.push(null);
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
      for (const keyword of keywords) {
        let node = 0;
        for (let i = 0; i < keyword.length; i++) {
          node += this.base[node] + this.code.get(keyword[i])!;
        }

        if (this.keywords[node] == null) {
          this.keywords[node] = [];
        }
        this.keywords[node]!.push(keyword);
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
          let failure = this.failure[parent];
          while (failure >= 0 && this.check[(failure + this.base[failure] + leaf)] !== failure) {
            failure = this.failure[failure];
          }
          const next = failure < 0 ? -1 : (failure + this.base[failure] + leaf);
          this.failure[node] = next < 0 ? 0 : this.check[next] !== failure ? 0 : next;

          const inherits = this.keywords[this.failure[node]] ?? [];
          if (inherits.length > 0) {
            if (this.keywords[node] == null) {
              this.keywords[node] = [];
            }
            for (const keyword of inherits) {
              this.keywords[node].push(keyword);
            }
          }

          queue.push([node, trie.go(leaf)!]);
        }
      }
    }
  }

  public go(node: number, character: string): number {
    const code = this.code.get(character);
    if (code == null) { return 0; }

    while (node >= 0) {
      const next = node + this.base[node] + code;
      if (this.check[next] === node) { return next; }
      node = this.failure[node];
    }
    return Math.max(node, 0);
  }

  public query(node: number): string[] {
    return this.keywords[node] ?? [];
  }
}

export class AhoCorasick {
  private trie: DoubleArray;

  constructor(keywords: string[]) {
    this.trie = new DoubleArray(keywords);
  }

  public hasKeywordInText(text: string): boolean {
    let node = 0;
    for (let i = 0; i < text.length; i++) {
      if (this.trie.query(node).length > 0) { return true; }
      node = this.trie.go(node, text[i]);
    }

    return this.trie.query(node).length > 0;
  }

  public matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];

    let node = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      node = this.trie.go(node, ch);

      for (const keyword of this.trie.query(node)) {
        const begin = (i + 1) - keyword.length;
        const end = (i + 1);
        result.push({ begin, end, keyword });
      }
    }

    return result;
  }
}
