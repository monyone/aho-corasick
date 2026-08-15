import { type Deque, RingDeque, LinkedDeque } from "./deque.mts";

export default class Collector {
  private deque: Deque<string>;
  private consumed = 0;
  private remains = 0;
  private bound = 0;

  public constructor(capacity?: number) {
    if (capacity != null) {
      this.deque = new RingDeque<string>(capacity);
    } else {
      this.deque = new LinkedDeque<string>();
    }
  }

  public feed(chunk: string) {
    // 空文字を突っ込まれると無意味に capacity を消費するので、最低でも 1 文字以上とする
    if (chunk.length <= 0) { return; }

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

  public consume(length: number, consumeFn: (elem: string) => void): void {
    length = Math.min(length, this.remains);

    while (length > 0 && !this.deque.empty()) {
      const chunk = this.deque.pollFirst()!;
      const avail = chunk.length - this.consumed;

      if (avail >= length) {
        const end = this.consumed + length;
        if (this.consumed === 0 && end === chunk.length) {
          consumeFn(chunk);
        } else {
          consumeFn(chunk.slice(this.consumed, end));
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
        consumeFn(chunk.slice(this.consumed));
        this.consumed = 0;
        this.remains -= avail;
        length -= avail;
      }
    }
  }

  public take(length: number): string[] {
    const collect: string[] = [];
    this.consume(length, (elem) => { collect.push(elem); });
    return collect;
  }

  public skip(length: number): void {
    this.consume(length, () => {});
  }
}
