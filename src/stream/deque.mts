export default class Deque<T> {
  private deque: (T | null)[];
  private readonly capacity: number;
  private head = 0;
  private tail = 0;

  public constructor(capacity: number) {
    this.capacity = capacity + 1;
    this.deque = Array.from({ length: capacity + 1}, () => null);
  }

  public clone(): Deque<T> {
    const deque = new Deque<T>(this.capacity - 1);
    for (const elem of this) {
      deque.addLast(elem);
    }
    return deque;
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
    this.head = (this.head + 1) % this.capacity;
    return elem;
  }

  public pollLast(): T | null {
    if (this.empty()) { return null; }
    const elem = this.peekLast();
    this.tail = (this.tail - 1 + this.capacity) % this.capacity;
    return elem;
  }

  *[Symbol.iterator]() {
    for (let i = this.head; i !== this.tail; i = (i + 1) % this.capacity) {
      yield this.deque[i]!;
    }
  }
}
