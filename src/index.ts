class Trie {
  private goto: Map<string, Trie> = new Map<string, Trie>();
  public keywords: string[] = []
  public failure: Trie | null = null;

  public has(s: string) {
    return this.goto.has(s);
  }
  public get(s: string) {
    return this.goto.get(s);
  }
  public set(s: string, next: Trie) {
    return this.goto.set(s, next);
  }
  public entries() {
    return this.goto.entries();
  }

  public empty() {
    return this.keywords.length === 0;
  }
  public add(k: string) {
    this.keywords.push(k);
  }
  public merge(t: Trie) {
    this.keywords.push(... t.keywords);
  }
}

export class AhoCorasick {
  private root = new Trie();

  constructor(keywords: string[]) {
    // build goto
    for (const keyword of keywords) {
      let current: Trie = this.root;
      for (const ch of keyword) {
        let next: Trie = current.get(ch) ?? (new Trie())
        current.set(ch, next);
        current = next;
      }
      current.add(keyword);
    }

    // build failure
    const queue: [Trie, Trie, string][] = [];
    for (const [ch, next] of this.root.entries()) {
      queue.push([next, this.root, ch]);
    }
    while (queue.length > 0) {
      const [current, parent, ch] = queue.shift()!;

      let failure = parent.failure;
      while (failure != null && !failure.has(ch)) {
        failure = failure.failure;
      }
      current.failure = failure?.get(ch) ?? this.root;
      current.merge(current.failure);

      for (const [ch, next] of current.entries()) {
        queue.push([next, current, ch]);
      }
    }

    this.root.failure = this.root;
  }

  hasKeywordInText(text: string): boolean {
    let state: Trie = this.root;
    for (const ch of text) {
      if (!state.empty()) { return true; }

      let next = state.get(ch);
      while (next == null) {
        state = state.failure!;
        next = state.get(ch) ?? (state !== this.root ? undefined : this.root);
      }
      state = next;
    }

    return !state.empty();
  }

  matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];
    const chs = Array.from(text);

    let state: Trie = this.root;
    for (let i = 0; i < chs.length; i++) {
      if (!state.empty()) {
        for (const keyword of state.keywords) {
          const begin = i - keyword.length;
          const end = i;
          result.push({ begin, end, keyword });
        }
      }

      const ch = chs[i];

      let next = state.get(ch);
      while (next == null) {
        state = state.failure!;
        next = state.get(ch) ?? (state !== this.root ? undefined : this.root);
      }
      state = next;
    }

    if (!state.empty()) {
      for (const keyword of state.keywords) {
        const begin = chs.length - keyword.length;
        const end = chs.length;
        result.push({ begin, end, keyword });
      }
    }

    return result;
  }
}
