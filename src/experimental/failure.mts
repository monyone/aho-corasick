/*
  ## 背景
  構築を O(M^2) くらいにして Failure 時に償却 O(N) にするタイプ
  構築が重い分はやくなってほしいが...
*/

class Trie {
  public readonly parent: Trie | null = null;
  public readonly depth: number;
  private keyword: string | null = null;
  private failure_pop: [number, string][] = [];
  private goto: Map<string, Trie> = new Map<string, Trie>();

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
  public children() {
    return this.goto.values();
  }

  // related falure pop
  public register(pop: [number, string][]) {
    this.failure_pop = pop;
  }
  public confirmed() {
    return this.failure_pop;
  }

  // related keyword
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
    const characters = new Set<string>();

    // build goto
    for (const keyword of keywords) {
      let current = this.root;
      for (let i = 0; i < keyword.length; i++) {
        const ch = keyword[i];
        characters.add(ch);

        const next = current.go(ch) ?? (new Trie(current))
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

    // build dfs (failure link conversion)
    {
      let top = 0;
      const queue: Trie[] = [];
      queue.push(this.root);
      while (top < queue.length) {
        const current = queue[top++];
        const current_depth = current.depth;

        const failure = this.failure_link.get(current) ?? this.root;
        const new_depth = failure.depth;
        const failure_pop: [number, string][] = [];
        let desire_depth = current_depth - new_depth;
        for (let node: Trie | null = current; node != null; node = node.parent) {
          if (node.empty()) { continue; }
          if (node.depth > desire_depth) { continue; }
          failure_pop.push([node.depth, node.value()!]);
          desire_depth -= node.value()!.length;
        }
        failure_pop.reverse();
        current.register(failure_pop);

        for (const next of current.children()) {
          queue.push(next);
        }
      }
    }
  }

  public *matchInText(text: string): Iterable<{ begin: number, end: number, keyword: string }> {
    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (!state.can(ch)) { // use failure
        while (state !== this.root && !state.can(ch)) {
          for (const [depth, keyword] of state.confirmed()) {
            const length = keyword.length;
            const begin = i - (state.depth - depth) - length;
            const end = i - (state.depth - depth);
            yield { begin, end, keyword };
          }
          state = this.failure_link.get(state)!;
        }
      }
      state = state.go(ch) ?? this.root;
    }

    while (state !== this.root) {
      for (const [depth, keyword] of state.confirmed()) {
        const length = keyword.length;
        const begin = text.length - (state.depth - depth) - length;
        const end = text.length - (state.depth - depth);
        yield { begin, end, keyword };
      }
      state = this.failure_link.get(state)!;
    }
  }
}
