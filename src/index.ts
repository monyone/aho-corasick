class Trie {
  public readonly parent: Trie | null = null;
  private goto: Map<string, Trie> = new Map<string, Trie>();
  public readonly keywords: Set<string> = new Set<string>();

  public constructor(parent?: Trie) {
    this.parent = parent ?? null;
  }

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
    return this.keywords.size === 0;
  }
  public add(k: string) {
    this.keywords.add(k);
  }
  public delete(k: string) {
    this.keywords.delete(k)
  }
  public merge(t?: Trie) {
    for(const keyword of t?.keywords ?? []) {
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
        let next = current.get(ch) ?? (new Trie(current))
        current.set(ch, next);
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
      while (failure != null && !failure.has(ch)) {
        failure = this.failure_link.get(failure) ?? null;
      }
      failure = failure?.get(ch) ?? this.root;
      this.failure_link.set(current, failure);
      current.merge(failure);

      for (const [ch, next] of current.entries()) {
        queue.push([next, ch]);
      }
    }
  }

  hasKeywordInText(text: string): boolean {
    let state: Trie = this.root;
    for (const ch of text) {
      if (!state.empty()) { return true; }

      while (!state.has(ch) && state !== this.root) {
        state = this.failure_link.get(state)!;
        if (state.has(ch)) { break; }
      }
      state = state.get(ch) ?? this.root;
    }

    return !state.empty();
  }

  matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];
    const chs = Array.from(text);

    let state: Trie = this.root;
    for (let i = 0; i < chs.length; i++) {
      for (const keyword of state.keywords) {
        const begin = i - keyword.length;
        const end = i;
        result.push({ begin, end, keyword });
      }

      const ch = chs[i];

      while (!state.has(ch) && state !== this.root) {
        state = this.failure_link.get(state)!;
        if (state.has(ch)) { break; }
      }
      state = state.get(ch) ?? this.root;
    }

    for (const keyword of state.keywords) {
      const begin = chs.length - keyword.length;
      const end = chs.length;
      result.push({ begin, end, keyword });
    }

    return result;
  }
}

export class DynamicAhoCorasick extends AhoCorasick {
  protected invert_failure_link = new Map<Trie, Set<Trie>>();

  constructor(keywords: string[]) {
    super(keywords);

    // build invert failure
    const queue: Trie[] = [];
    for (const [_, next] of this.root.entries()) {
      queue.push(next);
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      const failure = this.failure_link.get(current);
      if (failure == null) { continue; }

      if (!this.invert_failure_link.has(failure)) {
        this.invert_failure_link.set(failure, new Set<Trie>());
      }
      this.invert_failure_link.get(failure)!.add(current);

      for (const [_, next] of current.entries()) {
        queue.push(next);
      }
    }
  }

  append(keyword: string) {
    let parent = this.root;
    const chs = Array.from(keyword);

    // failure
    for (let i = 0; i < chs.length; i++) {
      const ch = chs[i];
      const current = parent.get(ch) ?? (new Trie(parent));
      parent.set(ch, current);
      if (i === chs.length - 1) { current.add(keyword); }

      // build failure link
      let failure = this.failure_link.get(parent) ?? null;
      while (failure != null && !failure.has(ch)) {
        failure = this.failure_link.get(failure) ?? null;
      }
      failure = failure?.get(ch) ?? this.root;
      this.failure_link.set(current, failure);
      if (!this.invert_failure_link.has(failure)) {
        this.invert_failure_link.set(failure, new Set<Trie>());
      }
      this.invert_failure_link.get(failure)!.add(current);
      current.merge(failure);

      // keep consistency for affected tries
      if (!this.invert_failure_link.has(current)) {
        this.invert_failure_link.set(current, new Set<Trie>());
      }
      for (const invert_failure of Array.from(this.invert_failure_link.get(failure)!)) {
        if (invert_failure.parent == null) { continue; }
        if (invert_failure.parent.get(ch) !== invert_failure) { continue; } // root node is fallback, so specify ege
        { // recalc failure in invert_failure
          let failure = this.failure_link.get(invert_failure.parent) ?? null;
          while (failure != null && !failure.has(ch)) {
            failure = this.failure_link.get(failure) ?? null;
          }
          if (failure?.get(ch) !== current) { continue; }
        }

        this.failure_link.set(invert_failure, current);
        this.invert_failure_link.get(failure)!.delete(invert_failure);
        this.invert_failure_link.get(current)!.add(invert_failure);
      }

      parent = current;
    }

    // propagete added keyword
    const current = parent;
    const queue: Trie[] = [current];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const invert_failure of (this.invert_failure_link.get(current)?.values() ?? [])) {
        invert_failure.merge(current);
        queue.push(invert_failure);
      }
    }
  }
}
