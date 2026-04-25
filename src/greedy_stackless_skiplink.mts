/*
  ## 背景
  Trie に キーワードのリンクを埋め込んでみる用途のもの
  これはテスト用なので、パッケージとしてはサポートしない
  Trie のなかに埋め込めばキャッシュに乗りやすいかなと思ってやってみた

  ## 既知の問題
  * Trie の子から親にたどるので逆順になる
    * 取った後 reserve しないと順番通りにならない
    * reverse があっても計算量的には影響しないが、あまり好ましくない
  * failure 時のキーワードたどるのは償却にならない
    * 厳密に 償却O(N) の計算量にはならない
    * なぜなら、まだ確定してない部分を何度もチェックするから
    * stack で見ると下から即時で押し出すのではなく、上から下に探して押し出す感じになってる
*/

class Trie {
  public readonly parent: Trie | null = null;
  public readonly depth: number;
  public skiplink: Trie | null = null;
  private keyword: string | null = null;
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
      let current = this.root;
      for (let i = 0; i < keyword.length; i++) {
        const ch = keyword[i];
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

    // build nearest keyword link
    {
      const stack: [Trie, MapIterator<Trie>][] = [[this.root, this.root.children()]];
      while (stack.length > 0) {
        const [trie, iter] = stack[stack.length - 1];

        const { value: next, done } = iter.next();
        if (done) {
          stack.length -= 1;
          continue;
        }

        if (!next.empty()) {
          const length = next.value()!.length;
          const target = stack[stack.length - length][0];
          if (!target.empty()) {
            next.skiplink = target;
          } else {
            next.skiplink = target.skiplink;
          }
        } else if (!trie.empty()) {
          next.skiplink = trie;
        } else {
          next.skiplink = trie.skiplink;
        }

        stack.push([next, next.children()]);
      }
    }
  }

  public *matchInText(text: string): Iterable<{ begin: number, end: number, keyword: string }> {
    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!state.can(ch)) { // use failure
        const old_state = state;
        const old_depth = state.depth;
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
        const new_depth = state.depth;
        const desire_depth = old_depth - new_depth;

        {
          const results = [];
          for (let node: Trie | null = old_state; node != null; node = node.skiplink) {
            if (node.empty()) { continue; }
            if (node.depth > desire_depth) { continue; }

            const keyword = node.value()!;
            const length = keyword.length;
            const begin = i - (old_depth - node.depth) - length;
            const end = i - (old_depth - node.depth);

            results.push({ begin, end, keyword });
          }
          yield* results.reverse();
        }
      }
      state = state.go(ch) ?? this.root;
    }

    {
      const results = [];
      for (let node: Trie | null = state; node != null; node = node.skiplink) {
        if (node.empty()) { continue; }

        const keyword = node.value()!;
        const length = keyword.length;
        const begin = text.length - (state.depth - node.depth) - length;
        const end = text.length - (state.depth - node.depth);

        results.push({ begin, end, keyword });
      }
      yield* results.reverse();
    }
  }
}
