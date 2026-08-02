export default class RingBuffer<T> {
  private capacity: number;
  private ring: (T | null)[];
  private front = 0;
  private tail = 0;
  private reference = 0;

  public constructor(capacity: number) {
    this.capacity = capacity + 1;
    this.ring = Array.from({ length: this.capacity }, () => null);
  }

  public size(): number {
    return (this.tail - this.front + this.capacity) % this.capacity;
  }

  public empty(): boolean {
    return this.size() === 0;
  }

  public full(): boolean {
    return this.size() === this.capacity - 1;
  }

  public remove(): void {
    if (this.empty()) { return; }
    this.ring[this.front] = null;
    this.front = (this.front + 1) % this.capacity;
  }

  public push(value: T): void {
    if (this.full()) { this.remove(); }
    this.ring[this.tail] = value;
    this.tail = (this.tail + 1) % this.capacity;
    this.reference += 1;
  }

  public get(position: number): T | null {
    const index = this.size() - (this.reference - position);
    if (index < 0 || index >= this.size()) { return null; }
    return this.ring[(this.front + index) % this.capacity];
  }

  public reposition(position: number) {
    this.reference -= position;
  }
}
