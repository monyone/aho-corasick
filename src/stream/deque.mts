class LinkedListNode<T> {
  prev: LinkedListNode<T> | null = null;
  next: LinkedListNode<T> | null = null;
  elem: T | null;

  public constructor(elem?: T) {
    this.elem = elem ?? null;
  }
}

export default class Deque<T> {
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
