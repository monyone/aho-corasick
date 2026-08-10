export default class PersistentStack<T> {
  private parent: PersistentStack<T> | null;
  private elem: T;

  public constructor(elem: T, parent?: PersistentStack<T>) {
    this.parent = parent ?? null;
    this.elem = elem;
  }

  public value(): T {
    return this.elem;
  }

  public pop(): PersistentStack<T> | null {
    return this.parent;
  }

  public push(elem: T): PersistentStack<T> {
    return new PersistentStack<T>(elem, this);
  }

  *[Symbol.iterator](): Generator<T> {
    if (this.parent != null) {
      yield* this.parent;
    }
    yield this.elem;
  }
}
