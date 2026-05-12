import Deque from "./deque.mts";

export type Match = { begin: number, end: number, keyword: string };
export type Replacer = (detect: string) => string;

class Trie {
  public readonly parent: Trie | null = null;
  public readonly depth: number;
  private keyword: string | null = null;
  private goto: Map<string, Trie> = new Map<string, Trie>();

  public constructor(parent?: Trie) {
    this.parent = parent ?? null;
    this.depth =  (parent?.depth ?? -1) + 1;
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
      let current = this.root;
      for (let i = 0; i < keyword.length; i++) {
        const ch = keyword[i];
        let next = current.go(ch) ?? (new Trie(current))
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
  }

  public *matchInText(text: string): Iterable<Match> {
    const deque = new Deque<Match>();

    let confirmed_index = 0;
    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!state.can(ch)) { // use failure
        const old_depth = state.depth;
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
        const new_depth = state.depth;
        confirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
        while (!deque.empty()) {
          const first = deque.peekFirst()!;
          if (first.end > confirmed_index) { break; }
          yield deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) - length;
        const end = (i + 1);

        while (true) {
          if (deque.empty()) {
            deque.addLast({ begin, end, keyword });
            break;
          }

          const last = deque.peekLast()!;
          if (last.end <= begin) {
            deque.addLast({ begin, end, keyword });
            break;
          } else if (begin > last.begin) {
            break;
          } else {
            deque.pollLast();
          }
        }
      }
    }

    while (!deque.empty()) {
      yield deque.pollFirst()!;
    }
  }

  protected *replaceProcessText(trie: Trie, deque: Deque<Match>, remain_text: string, remain_offset: number, replacer: Replacer): Generator<string, [trie: Trie, remain_text: string], unknown> {
    let state = trie;
    let confirmed_index = 0;
    let output_begin = 0;

    for (let i = remain_offset; i < remain_text.length; i++) {
      const ch = remain_text[i];
      if (!state.can(ch)) { // use failure
        const old_depth = state.depth;
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
        const new_depth = state.depth;
        confirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
        while (!deque.empty()) {
          const first = deque.peekFirst()!;
          if (first.end > confirmed_index) { break; }

          if (output_begin < first.begin) {
            yield remain_text.slice(output_begin, first.begin);
          }
          yield replacer(remain_text.slice(first.begin, first.end));
          output_begin = first.end;

          deque.pollFirst()!;
        }
      }
      state = state.go(ch) ?? this.root;

      if (!state.empty()) {
        const keyword = state.value()!;
        const length = keyword.length;
        const begin = (i + 1) - length;
        const end = (i + 1);

        while (true) {
          if (deque.empty()) {
            deque.addLast({ begin, end, keyword });
            break;
          }

          const last = deque.peekLast()!;
          if (last.end <= begin) {
            deque.addLast({ begin, end, keyword });
            break;
          } else if (begin > last.begin) {
            break;
          } else {
            deque.pollLast();
          }
        }
      }
    }

    if (output_begin < confirmed_index) {
      yield remain_text.slice(output_begin, confirmed_index);
    }
    for (const elem of deque) {
      elem.begin -= confirmed_index;
      elem.end -= confirmed_index;
    }
    remain_text = remain_text.slice(confirmed_index);

    return [state, remain_text];
  }
  protected *replaceCleanupText(deque: Deque<Match>, text: string, replacer: Replacer): Iterable<string> {
    let output_begin = 0;
    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield text.slice(output_begin, first.begin);
      }
      yield replacer(text.slice(first.begin, first.end));
      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < text.length) {
      yield text.slice(output_begin, text.length);
    }
  }

  public *replaceSync(iterable: Iterable<string>, replacer: Replacer): Iterable<string> {
    const deque = new Deque<Match>();

    let state: Trie = this.root;
    let remain_text = '';
    let remain_offset = 0;

    for (const text of iterable) {
      remain_text += text;
      ([state, remain_text] = yield* this.replaceProcessText(state, deque, remain_text, remain_offset, replacer));
      remain_offset = remain_text.length;
    }
    yield* this.replaceCleanupText(deque, remain_text, replacer);
  }

  public async *replaceAsync(iterable: AsyncIterable<string>, replacer: Replacer): AsyncIterable<string> {
    const deque = new Deque<Match>();

    let state: Trie = this.root;
    let remain_text = '';
    let remain_offset = 0;

    for await (const text of iterable) {
      remain_text += text;
      ([state, remain_text] = yield* this.replaceProcessText(state, deque, remain_text, remain_offset, replacer));
      remain_offset = remain_text.length;
    }
    yield* this.replaceCleanupText(deque, remain_text, replacer);
  }
}

