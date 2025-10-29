class Trie {
  public readonly parent: Trie | null = null;
  private goto: Map<string, Trie> = new Map<string, Trie>();
  private keywords: Set<string> = new Set<string>();

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

  public defunct() {
    return this.goto.size === 0 && this.keywords.size === 0;
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

  public hasKeywordInText(text: string): boolean {
    let state: Trie = this.root;
    for (const ch of text) {
      if (!state.empty()) { return true; }

      while (!state.can(ch) && state !== this.root) {
        state = this.failure_link.get(state)!;
        if (state.can(ch)) { break; }
      }
      state = state.go(ch) ?? this.root;
    }

    return !state.empty();
  }

  public matchInText(text: string): { begin: number, end: number, keyword: string }[] {
    const result: { begin: number, end: number, keyword: string }[] = [];
    const chs = Array.from(text);

    let state: Trie = this.root;
    for (let i = 0; i < chs.length; i++) {
      for (const keyword of state.values()) {
        const begin = i - keyword.length;
        const end = i;
        result.push({ begin, end, keyword });
      }

      const ch = chs[i];

      while (!state.can(ch) && state !== this.root) {
        state = this.failure_link.get(state)!;
        if (state.can(ch)) { break; }
      }
      state = state.go(ch) ?? this.root;
    }

    for (const keyword of state.values()) {
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

  public add(keyword: string): void {
    let parent = this.root;
    const chs = Array.from(keyword);

    // failure
    for (let i = 0; i < chs.length; i++) {
      const ch = chs[i];
      const current = parent.go(ch) ?? (new Trie(parent));
      parent.define(ch, current);
      if (i === chs.length - 1) { current.add(keyword); }

      // build failure link
      let failure = this.failure_link.get(parent) ?? null;
      while (failure != null && !failure.can(ch)) {
        failure = this.failure_link.get(failure) ?? null;
      }
      failure = failure?.go(ch) ?? this.root;
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
      let queue: Trie[] = [... (this.invert_failure_link.get(parent) ?? [])];
      while (queue.length > 0) {
        const before = queue.shift()!;

        if (before.can(ch)) {
          const invert_failure = before.go(ch)!;
          this.failure_link.set(invert_failure, current);
          this.invert_failure_link.get(failure)!.delete(invert_failure);
          this.invert_failure_link.get(current)!.add(invert_failure);
          continue;
        }

        queue.push(... (this.invert_failure_link.get(before) ?? []))
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

  public delete(keyword: string) {
    let target = this.root;
    const chs = Array.from(keyword);
    for (const ch of chs) {
      if (!target.can(ch)) { return; }
      target = target.go(ch)!;
    }
    if (!target.contains(keyword)) { return; }

    target.delete(keyword);
    const queue: Trie[] = [target];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const invert_failure of (this.invert_failure_link.get(current)?.values() ?? [])) {
        invert_failure.delete(keyword);
        queue.push(invert_failure);
      }
    }

    // remove defunct nodes
    for (let leaf: Trie | null = target, index: number = chs.length - 1; leaf != null && leaf.defunct(); leaf = leaf.parent ?? null, index--) {
      leaf.parent?.undef(chs[index]);

      const failure = this.failure_link.get(leaf)!;
      this.invert_failure_link.get(failure)!.delete(leaf);
      for (const invert_failure of (this.invert_failure_link.get(leaf) ?? [])) {
        this.failure_link.set(invert_failure, failure);
        this.invert_failure_link.get(failure)!.add(invert_failure);
      }

      this.failure_link.delete(leaf);
      this.invert_failure_link.delete(leaf);
    }
  }
}
