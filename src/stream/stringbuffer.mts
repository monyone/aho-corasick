import { isPromiseLike } from "./base.mts";

export class StringBuffer<T, K> {
  private values: (T | K)[] = [];

  public push(operation: (text: string) => T | K, chunk: string): void {
    this.values.push(operation(chunk));
  }

  public data(): (T | K)[] {
    return this.values;
  }
}

export class AsyncableStringBuffer<T, K> {
  private values: (T | K)[] = [];

  public async push( operation: (text: string) => T | K | PromiseLike<K>, chunk: string): Promise<void>{
    const data = operation(chunk);
    this.values.push(!isPromiseLike(data) ? data : await data);
  }

  public data(): (T | K)[] {
    return this.values;
  }
}
