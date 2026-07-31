import Deque from "./deque.mts";

export default class Collector {
  private deque = new Deque<string>();
  private consumed = 0;
  private remains = 0;
  private bound = 0;

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

  public *take(length: number): Iterable<string> {
    length = Math.min(length, this.remains);

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
        this.consumed = 0;
        this.remains -= avail;
        length -= avail;
      }
    }
  }

  public skip(length: number): void {
    length = Math.min(length, this.remains);

    while (length > 0 && !this.deque.empty()) {
      const chunk = this.deque.pollFirst()!;
      const avail = chunk.length - this.consumed;

      if (avail >= length) {
        const end = this.consumed + length;

        if (end === chunk.length) {
          this.consumed = 0
        } else {
          this.deque.addFirst(chunk);
          this.consumed += length;
        }
        this.remains -= length;
        length = 0;
      } else {
        this.consumed = 0;
        this.remains -= avail;
        length -= avail;
      }
    }
  }
}
