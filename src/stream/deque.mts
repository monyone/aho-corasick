export interface Deque<T> {
  empty(): boolean;
  full(): boolean;
  size(): number;
  addFirst(elem: T): void;
  addLast(elem: T): void;
  peekFirst(): T | null;
  peekLast(): T | null;
  pollFirst(): T | null;
  pollLast(): T | null;
  [Symbol.iterator](): Iterator<T>;
}

class LinkedListNode<T> {
  prev: LinkedListNode<T> | null = null;
  next: LinkedListNode<T> | null = null;
  elem: T | null;

  public constructor(elem?: T) {
    this.elem = elem ?? null;
  }
}

export class LinkedDeque<T> implements Deque<T> {
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

  public full(): boolean {
    return false;
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

  *[Symbol.iterator](): Iterator<T> {
    let node = this.begin.next!;
    while (node !== this.end) {
      yield node.elem!;
      node = node.next!;
    }
  }
}

export class RingDeque<T> implements Deque<T> {
  private deque: (T | null)[];
  private readonly capacity: number;
  private head = 0;
  private tail = 0;

  public constructor(capacity: number) {
    this.capacity = capacity + 1;
    this.deque = Array.from({ length: capacity + 1}, () => null);
  }

  public empty(): boolean {
    return this.head === this.tail;
  }

  public size(): number {
    return (this.tail - this.head + this.capacity) % this.capacity;
  }

  public full(): boolean {
    return this.size() === this.capacity - 1;
  }

  private get first(): number | null {
    if (this.empty()) { return null; }
    return this.head;
  }
  private get last(): number | null {
    if (this.empty()) { return null; }
    return (this.tail - 1 + this.capacity) % this.capacity;
  }

  public addFirst(elem: T): void {
    while (this.full()) {
      this.pollLast();
    }
    this.head = (this.head - 1 + this.capacity) % this.capacity;
    this.deque[this.head] = elem;
  }

  public addLast(elem: T): void {
    while (this.full()) {
      this.pollFirst();
    }
    this.deque[this.tail] = elem;
    this.tail = (this.tail + 1) % this.capacity;
  }

  public peekFirst(): T | null {
    if (this.empty()) { return null; }
    return this.deque[this.first!];
  }

  public peekLast(): T | null {
    if (this.empty()) { return null; }
    return this.deque[this.last!];
  }

  public pollFirst(): T | null {
    if (this.empty()) { return null; }
    const elem = this.peekFirst()!;
    this.deque[this.first!] = null;
    this.head = (this.head + 1) % this.capacity;
    return elem;
  }

  public pollLast(): T | null {
    if (this.empty()) { return null; }
    const elem = this.peekLast();
    this.deque[this.last!] = null;
    this.tail = (this.tail - 1 + this.capacity) % this.capacity;
    return elem;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let i = this.head; i !== this.tail; i = (i + 1) % this.capacity) {
      yield this.deque[i]!;
    }
  }
}
