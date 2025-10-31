class Trie {
  public readonly parent: Trie | null = null;
  public readonly depth: number;
  private goto: Map<string, Trie> = new Map<string, Trie>();
  private keywords: Set<string> = new Set<string>();
  public isdata: boolean = false;

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
      let current = this.root;
      for (let i = 0; i < keyword.length; i++) {
        const ch = keyword[i];
        let next = current.go(ch) ?? (new Trie(current))
        current.define(ch, next);
        current = next;
      }
      current.add(keyword);
      current.isdata = true;
    }

    // build failure pt1
    {
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

    // build failure pt2
    {
      const queue: [Trie, string][] = [];
      for (const [ch, next] of this.root.entries()) {
        queue.push([next, ch]);
      }
      while (queue.length > 0) {
        const [current, ch] = queue.shift()!;
        const parent = current.parent!;

        // calc failure
        if (!current.isdata) {
          let failure = this.failure_link.get(parent) ?? null;
          while (failure != null && !failure.can(ch)) {
            failure = this.failure_link.get(failure) ?? null;
          }
          failure = failure?.go(ch) ?? this.root;
          this.failure_link.set(current, failure);
        } else {
          this.failure_link.set(current, this.root);
        }

        for (const [ch, next] of current.entries()) {
          queue.push([next, ch]);
        }
      }
    }
  }

  public matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];

    let state: Trie = this.root;
    let candidates: { begin: number, end: number, keyword: string }[] = [];
    for (let i = 0; i < text.length; i++) {
      for (const keyword of state.values()) {
        const length = keyword.length;
        const begin = i - length;
        const end = i;

        while (true) {
          if (candidates.length === 0) {
            candidates.push({ begin, end, keyword })
            break;
          }

          const stack = candidates.length - 1;
          if (candidates[candidates.length - 1].end <= begin) {
            candidates.push({ begin, end, keyword });
            break;
          } else if (begin > candidates[stack].begin) {
            break;
          } else {
            candidates.pop();
          }
        }
      }

      const ch = text[i];
      if (!state.can(ch)) { // use failure
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
        const start = i - state.depth;

        result.push(... candidates.filter(({ end }) => end <= start));
        candidates = candidates.filter(({ end }) => end > start);
      }
      state = state.go(ch) ?? this.root;
    }

    for (const keyword of state.values()) {
      const length = keyword.length;
      const begin = text.length - length;
      const end = text.length;

      while (true) {
        if (candidates.length === 0) {
          candidates.push({ begin, end, keyword })
          break;
        }

        const stack = candidates.length - 1;
        if (candidates[candidates.length - 1].end <= begin) {
          candidates.push({ begin, end, keyword });
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
