class Trie {
  public readonly parent: Trie | null = null;
  private goto: Map<string, Trie> = new Map<string, Trie>();
  private keyword: string | null = null;

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
      let current: Trie = this.root;
      for (let i = 0; i < keyword.length; i++) {
        const ch = keyword[i];
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

      if (current.empty()) { // calc failure
        let failure = this.failure_link.get(parent) ?? null;
        while (failure != null && !failure.can(ch)) {
          failure = this.failure_link.get(failure) ?? null;
        }
        failure = failure?.go(ch) ?? this.root;
        this.failure_link.set(current, failure);
        current.merge(failure);
      } else { // if keyword, immidiate root
        this.failure_link.set(current, this.root);
      }

      for (const [ch, next] of current.entries()) {
        queue.push([next, ch]);
      }
    }
  }

  public matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];

    let state: Trie = this.root;
    let candidates: { begin: number, end: number, keyword: string }[] = [];
    for (let i = 0; i < text.length; i++) {
      if (!state.empty()){
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = i - length;

        while (true) {
          if (candidates.length === 0) {
            candidates.push({ begin, end: i, keyword })
            break;
          }

          const stack = candidates.length - 1;
          if (candidates[candidates.length - 1].end <= begin) {
            candidates.push({ begin, end: i, keyword });
            break;
          } else if (begin > candidates[stack].begin) {
            break;
          } else {
            candidates.pop();
          }
        }
      }

      const ch = text[i];
      if (!state.can(ch)) {  // use failre
        for (let i = 0; i < candidates.length - 1; i++) {
          result.push(candidates[i]);
        }

        while (!state.can(ch) && state !== this.root) {
          state = this.failure_link.get(state)!;
          if (state.can(ch)) { break; }
        }

        const remain_candidate = candidates.length >= 1 ? candidates[candidates.length - 1] : null;
        candidates = [];
        if (remain_candidate) { candidates.push(remain_candidate); }
      }
      state = state.go(ch) ?? this.root;
    }

    if (!state.empty()){
      const keyword = state.value()!;
      const length = keyword.length;
      const begin = text.length - length;

      while (true) {
        if (candidates.length === 0) {
          candidates.push({ begin, end: text.length, keyword })
          break;
        }

        const stack = candidates.length - 1;
        if (candidates[candidates.length - 1].end <= begin) {
          candidates.push({ begin, end: text.length, keyword });
          break;
        } else if (begin > candidates[stack].begin) {
          break;
        } else {
          candidates.pop();
        }
      }
    }
    for (const candidate of candidates) {
      result.push(candidate);
    }

    return result;
  }
}
