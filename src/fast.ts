class DoubleArray {
  private code: Map<string, number>;
  private base: number[] = [0];
  private check: number[] = [-1];
  private failure: number[] = [-1];
  private keywords: string[][] = [[]];

  public constructor(keywords: string[]) {
    const set = new Set<string>();
    for (const keyword of keywords) {
      for (const character of keyword) {
        set.add(character);
      }
    }
    this.code = new Map<string, number>(Array.from(set.values()).map((v, i) => [v, i + 1]));
    const unique = new Set(keywords);
    const words = Array.from(unique.values()).map((keyword) => Array.from(keyword).map((character) => this.code.get(character)!));

    // construct Double Array
    {
      const queue: [number, number, number[][]][] = [[0, 0, words]];
      while (queue.length > 0) {
        const [node, depth, words] = queue.shift()!;
        const leafs = new Set(words.map((word) => word[depth]).filter(Boolean));
        const max_leaf = words.reduce((max, word) => Math.max(max, word[depth] ?? 0), 0);

        let offset = node;
        while (offset < this.check.length && this.check[offset] >= 0) { offset++; }
        LOOP:
        while (true) {
          for (const leaf of leafs) {
            const next = offset + leaf;
            if (next < this.check.length && this.check[next] >= 0) {
              offset = next + 1;
              continue LOOP;
            }
          }

          break;
        }
        this.base[node] = offset - node;

        const max = offset + max_leaf;
        while (this.base.length <= max) { this.base.push(0); }
        while (this.check.length <= max) { this.check.push(-1); }
        while (this.keywords.length <= max) { this.keywords.push([]); }
        while (this.failure.length <= max) { this.failure.push(-1); }

        for (const leaf of leafs) {
          const next = offset + leaf;
          this.check[next] = node;
          queue.push([next, depth + 1, words.filter((word) => word[depth] === leaf)]);
        }
      }
    }
    // Register Keyword
    {
      for (const keyword of keywords) {
        let node = 0;
        for (const character of keyword) {
          node += this.base[node] + this.code.get(character)!
        }
        this.keywords[node].push(keyword);
      }
    }
    // Build Failure
    {
      const queue: [number, number[][]][] = [[0, words]];
      while (queue.length > 0) {
        const [parent, words] = queue.shift()!;
        const leafs = Array.from(this.code.values()).filter((code) => words.some((word) => code === word[0]));

        for (const leaf of leafs) {
          const node = parent + this.base[parent] + leaf;
          let failure = this.failure[parent];
          while (failure >= 0 && this.check[(failure + this.base[failure] + leaf)] !== failure) {
            failure = this.failure[failure];
          }
          const next = failure < 0 ? -1 : (failure + this.base[failure] + leaf)
          this.failure[node] = next < 0 ? 0 : this.check[next] !== failure ? 0 : next;
          for (const keyword of this.keywords[this.failure[node]]) {
            this.keywords[node].push(keyword);
          }

          queue.push([node, words.filter((word) => word[0] === leaf).map((word) => word.slice(1))]);
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
    return this.keywords[node];
  }
}

export class AhoCorasick {
  private trie: DoubleArray;

  constructor(keywords: string[]) {
    this.trie = new DoubleArray(keywords);
  }

  public hasKeywordInText(text: string): boolean {
    let node = 0;
    for (const ch of text) {
      if (this.trie.query(node).length > 0) { return true; }
      node = this.trie.go(node, ch);
    }

    return this.trie.query(node).length > 0;
  }

  public matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];
    const chs = Array.from(text);

    let node = 0;
    for (let i = 0; i < chs.length; i++) {
      for (const keyword of this.trie.query(node)) {
        const begin = i - keyword.length;
        const end = i;
        result.push({ begin, end, keyword });
      }

      const ch = chs[i];
      node = this.trie.go(node, ch);
    }

    for (const keyword of this.trie.query(node)) {
      const begin = chs.length - keyword.length;
      const end = chs.length;
      result.push({ begin, end, keyword });
    }

    return result;
  }
}
