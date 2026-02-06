class LinkedListNode<T> {
  prev: LinkedListNode<T> | null = null;
  next: LinkedListNode<T> | null = null;
  elem: T | null;

  public constructor(elem?: T) {
    this.elem = elem ?? null;
  }
}

class Deque<T> {
  private begin: LinkedListNode<T>;
  private end: LinkedListNode<T>;
  private length: number = 0;

  public constructor() {
    this.begin = new LinkedListNode<T>();
    this.end = new LinkedListNode<T>();

    this.begin.prev = this.begin;
    this.end.next = this.end;

    this.begin.next = this.end;
    this.end.prev = this.begin;
  }

  public empty(): boolean {
    return this.begin.next === this.end;
  }

  public size(): number {
    return this.length;
  }

  private add(elem: T, prev: LinkedListNode<T>): void {
    const node = new LinkedListNode(elem);
    const next = prev.next!;

    prev.next = node;
    node.prev = prev;

    next.prev = node;
    node.next = next;

    this.length += 1;
  }

  public addFirst(elem: T): void {
    this.add(elem, this.begin);
  }

  public addLast(elem: T): void {
    this.add(elem, this.end.prev!);
  }

  public peekFirst(): T | null {
    return this.begin.next?.elem ?? null;
  }

  public peekLast(): T | null {
    return this.end.prev?.elem ?? null;
  }

  private poll(node: LinkedListNode<T>): T | null {
    const prev = node.prev!;
    const next = node.next!;

    prev.next = next;
    next.prev = prev;

    node.next = node.prev = null;

    this.length -= 1;

    return node.elem;
  }

  public pollFirst(): T | null {
    if (this.empty()) { return null; }
    return this.poll(this.begin.next!);
  }

  public pollLast(): T | null {
    if (this.empty()) { return null; }
    return this.poll(this.end.prev!);
  }

  *[Symbol.iterator]() {
    let node = this.begin.next!;
    while (node !== this.end) {
      yield node.elem!;
      node = node.next!;
    }
  }
}

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

  public *matchInText(text: string): Iterable<{ begin: number, end: number, keyword: string }> {
    const deque = new Deque<{ begin: number, end: number, keyword: string }>();

    let comfirmed_index = 0;
    let state: Trie = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!state.can(ch)) { // use failure
        const old_depth = state.depth;
        while (state !== this.root && !(state.can(ch))) {
          state = this.failure_link.get(state)!;
        }
        const new_depth = state.depth;
        comfirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
        while (!deque.empty()) {
          const first = deque.peekFirst()!;
          if (first.end > comfirmed_index) { break; }
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

  public *replaceSync(iterable: Iterable<string>, replacer: (detect: string) => string): Iterable<string> {
    const deque = new Deque<{ begin: number, end: number, keyword: string }>();

    let comfirmed_index = 0;
    let remain_text = '';
    let remain_offset = 0;
    let output_begin = 0;
    let state: Trie = this.root;

    for (const text of iterable) {
      remain_text += text;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (!state.can(ch)) { // use failure
          const old_depth = state.depth;
          while (state !== this.root && !(state.can(ch))) {
            state = this.failure_link.get(state)!;
          }
          const new_depth = state.depth;
          comfirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
          while (!deque.empty()) {
            const first = deque.peekFirst()!;
            if (first.end > comfirmed_index) { break; }

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
          const begin = remain_offset + (i + 1) - length;
          const end = remain_offset + (i + 1);

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

      if (output_begin < comfirmed_index) {
        yield remain_text.slice(output_begin, comfirmed_index);
      }
      for (const elem of deque) {
        elem.begin -= comfirmed_index;
        elem.end -= comfirmed_index;
      }
      remain_text = remain_text.slice(comfirmed_index);
      remain_offset = remain_text.length;
      output_begin = 0;
      comfirmed_index = 0;
    }

    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield remain_text.slice(output_begin, first.begin);
      }
      yield replacer(remain_text.slice(first.begin, first.end));
      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < remain_text.length) {
      yield remain_text.slice(output_begin, remain_text.length);
    }
  }

  public async *replaceAsync(iterable: AsyncIterable<string>, replacer: (detect: string) => string): AsyncIterable<string> {
    const deque = new Deque<{ begin: number, end: number, keyword: string }>();

    let comfirmed_index = 0;
    let remain_text = '';
    let remain_offset = 0;
    let output_begin = 0;
    let state: Trie = this.root;

    for await (const text of iterable) {
      remain_text += text;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (!state.can(ch)) { // use failure
          const old_depth = state.depth;
          while (state !== this.root && !(state.can(ch))) {
            state = this.failure_link.get(state)!;
          }
          const new_depth = state.depth;
          comfirmed_index += (old_depth - new_depth) + (state.can(ch) ? 0 : 1);
          while (!deque.empty()) {
            const first = deque.peekFirst()!;
            if (first.end > comfirmed_index) { break; }

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
          const begin = remain_offset + (i + 1) - length;
          const end = remain_offset + (i + 1);

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

      if (output_begin < comfirmed_index) {
        yield remain_text.slice(output_begin, comfirmed_index);
      }
      for (const elem of deque) {
        elem.begin -= comfirmed_index;
        elem.end -= comfirmed_index;
      }
      remain_text = remain_text.slice(comfirmed_index);
      remain_offset = remain_text.length;
      output_begin = 0;
      comfirmed_index = 0;
    }

    while (!deque.empty()) {
      const first = deque.peekFirst()!;

      if (output_begin < first.begin) {
        yield remain_text.slice(output_begin, first.begin);
      }
      yield replacer(remain_text.slice(first.begin, first.end));
      output_begin = first.end;

      deque.pollFirst()!;
    }

    if (output_begin < remain_text.length) {
      yield remain_text.slice(output_begin, remain_text.length);
    }
  }
}

