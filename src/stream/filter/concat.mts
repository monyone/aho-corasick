export default class ConcatIterator<T> implements Iterable<T>, Iterator<T> {
  private chunks: T[][] = [];
  private outer: number = 0;
  private inner: number = 0;

  public push(chunk: T | T[]): void {
    if (!Array.isArray(chunk)) {
      this.chunks.push([chunk]);
      return;
    }
    if (chunk.length === 0) { return; }
    this.chunks.push(chunk);
  }

  public [Symbol.iterator](): Iterator<T> {
    return this;
  }

  public next(): IteratorResult<T> {
    while (this.outer < this.chunks.length) {
      const chunk = this.chunks[this.outer];
      if (this.inner < chunk.length) {
        return { value: chunk[this.inner++], done: false };
      }
      this.outer++;
      this.inner = 0;
    }
    return { value: undefined, done: true };
  }
}
