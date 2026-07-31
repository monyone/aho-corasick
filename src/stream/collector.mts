import Deque from "./deque.mts";

export default class Collector {
  private deque = new Deque<string>();
  private consumed = 0;
  private remains = 0;
  private bound = 0;
  private last: string | null = null;

  public feed(chunk: string) {
    this.deque.addLast(chunk);
    this.remains += chunk.length;
    this.bound += chunk.length;
  }

  get length() {
    return this.bound;
  }

  public reposition(position: number) {
    this.bound -= position;
  }

  public peek(): string | null {
    if (this.deque.empty()) { return null; }
    const string = this.deque.peekFirst()!;
    return string[this.consumed] ?? null;
  }

  public tail(): string | null {
    return this.last;
  }

  public *take(length: number): Iterable<string> {
    length = Math.min(length, this.remains);
    this.last = null;

    while (length > 0 && !this.deque.empty()) {
      const chunk = this.deque.pollFirst()!;
      const avail = chunk.length - this.consumed;

      if (avail >= length) {
        const end = this.consumed + length;
        if (this.consumed === 0 && end === chunk.length) {
          yield chunk;
        } else {
          yield chunk.slice(this.consumed, end);
        }
        this.last = chunk[end - 1];

        if (end === chunk.length) {
          this.consumed = 0
        } else {
          this.deque.addFirst(chunk);
          this.consumed += length;
        }
        this.remains -= length;
        length = 0;
      } else {
        yield chunk.slice(this.consumed)
        this.last = chunk[chunk.length - 1];
        this.consumed = 0;
        this.remains -= avail;
        length -= avail;
      }
    }
  }

  public skip(length: number): void {
    length = Math.min(length, this.remains);
    this.last = null;

    while (length > 0 && !this.deque.empty()) {
      const chunk = this.deque.pollFirst()!;
      const avail = chunk.length - this.consumed;

      if (avail >= length) {
        const end = this.consumed + length;
        this.last = chunk[end - 1];

        if (end === chunk.length) {
          this.consumed = 0
        } else {
          this.deque.addFirst(chunk);
          this.consumed += length;
        }
        this.remains -= length;
        length = 0;
      } else {
        this.last = chunk[chunk.length - 1];
        this.consumed = 0;
        this.remains -= avail;
        length -= avail;
      }
    }
  }
}
