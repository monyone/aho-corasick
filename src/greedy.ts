class Trie {
  public readonly parent: Trie | null = null;
  public readonly depth: number;
  private goto: Map<string, Trie> = new Map<string, Trie>();
  private keywords: Set<string> = new Set<string>();

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
    return this.keywords.size === 0;
  }
  public contains(k: string) {
    return this.keywords.has(k);
  }
  public add(k: string) {
    this.keywords.add(k);
  }
  public delete(k: string) {
    this.keywords.delete(k)
  }
  public values() {
    return this.keywords.values();
  }
  public merge(t?: Trie) {
    for(const keyword of t?.values() ?? []) {
      this.keywords.add(keyword);
    }
  }
}

export class AhoCorasick {
  protected root = new Trie();
  protected failure_link = new Map<Trie, Trie>();

  constructor(keywords: string[]) {
    // build goto
    for (const keyword of keywords) {
      let current: Trie = this.root;
      for (const ch of keyword) {
        let next = current.go(ch) ?? (new Trie(current))
        current.define(ch, next);
        current = next;
      }
      current.add(keyword);
    }

    // build failure
    const queue: [Trie, string][] = [];
    for (const [ch, next] of this.root.entries()) {
      queue.push([next, ch]);
    }
    while (queue.length > 0) {
      const [current, ch] = queue.shift()!;
      const parent = current.parent!;

      // calc failure
      let failure = this.failure_link.get(parent) ?? null;
      while (failure != null && !failure.can(ch)) {
        failure = this.failure_link.get(failure) ?? null;
      }
      failure = failure?.go(ch) ?? this.root;
      this.failure_link.set(current, failure);
      current.merge(failure);

      for (const [ch, next] of current.entries()) {
        queue.push([next, ch]);
      }
    }
  }

  public matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];
    const chs = Array.from(text);

    let state: Trie = this.root;
    let candidate: string = '', candidate_begin = 0, candidate_length = 0;
    for (let i = 0; i < chs.length; i++) {
      for (const keyword of state.values()) {
        const length = Array.from(keyword).length;
        if (length > candidate_length ) {
          candidate = keyword;
          candidate_begin = i - length;
          candidate_length = length;
        }
      }

      const ch = chs[i];
      if (state.can(ch)) { // go forward
        state = state.go(ch) ?? this.root;
      } else { // use failre
        if (candidate !== '') {
          result.push({ begin: candidate_begin, end: candidate_begin + candidate_length , keyword: candidate });
        }

        let desire_depth = (state.depth - candidate_length);
        while (state !== this.root && !(state.can(ch) && state.depth < desire_depth)) {
          state = this.failure_link.get(state)!;
          if (state.can(ch) && state.depth < desire_depth) { break; }
        }

        candidate = '';
        candidate_begin = 0;
        candidate_length = 0;
        for (const keyword of state.values()) {
          const length = Array.from(keyword).length;
          if (length > candidate_length ) {
            candidate = keyword;
            candidate_begin = i - length;
            candidate_length = length;
          }
        }
        state = state.go(ch) ?? this.root;
      }
    }

    for (const keyword of state.values()) {
      const length = Array.from(keyword).length;
      if (length > candidate_length ) {
        candidate = keyword;
        candidate_begin = chs.length - length;
        candidate_length = length;
      }
    }
    if (candidate !== '') {
      result.push({ begin: candidate_begin, end: candidate_begin + candidate_length , keyword: candidate });
    }

    return result;
  }
}
