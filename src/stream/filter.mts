import { STOP_BEGIN, STOP_END, type Stop } from "./base.mts";
import Collector from "./collector.mts";

export interface StopFilter {
  write(chunk: string): Iterable<string | Stop>;
  end(): Iterable<string | Stop>;
}

const isWhitespace = (ch: string) => ch.length === 1 && /\s/.test(ch);
const SCHEME = "http";
const AFTER_SCHEME = SCHEME.length;
const SEPARATOR = "://";
const SEPARATOR_BASE = SCHEME.length + 1;
const BODY = SEPARATOR_BASE + SEPARATOR.length;

export class URLLikeStopFilter implements StopFilter {
  private collector: Collector = new Collector();
  private advance: number = 0;
  private steps: number = 0;

  public *write(chunk: string): Iterable<string | Stop> {
    this.collector.feed(chunk);
    for (let i = 0; i < chunk.length; i++) {
      yield* this.step(chunk[i]);
    }
  }

  public *end(): Iterable<string | Stop> {
    if (this.steps < BODY) {
      yield* this.collector.take(this.advance)
    } else if (this.steps >= BODY) {
      yield STOP_END;
    }
  }

  public *step(ch: string): Iterable<string | Stop>{
    if (this.steps < SCHEME.length) {
      if (ch === SCHEME[this.steps]) {
        this.steps++
        this.advance++;
      } else {
        if (this.steps > 0) {
          yield* this.collector.take(this.advance)
          this.collector.reposition(this.advance);
          this.steps = this.advance = 0;
          yield* this.step(ch);
        } else {
          yield* this.collector.take(this.advance + 1)
          this.collector.reposition(this.advance + 1);
          this.steps = this.advance = 0;
        }
      }
    } else if (this.steps === AFTER_SCHEME) {
      if (ch === 's') {
        this.steps = SEPARATOR_BASE
        this.advance++;
      } else if (ch === SEPARATOR[0]) {
        this.steps = SEPARATOR_BASE + 1;
        this.advance++;
      } else {
        yield* this.collector.take(this.advance);
        this.collector.reposition(this.advance);
        this.steps = this.advance = 0;
        yield* this.step(ch);
      }
    } else if (this.steps < BODY) {
      if (ch === SEPARATOR[this.steps - SEPARATOR_BASE]) {
        this.steps++
        this.advance++;
      } else {
        yield* this.collector.take(this.advance);
        this.collector.reposition(this.advance);
        this.steps = this.advance = 0;
        yield* this.step(ch);
      }
    } else if (this.steps === BODY) {
      if (!isWhitespace(ch)) {
        yield STOP_BEGIN;
        yield* this.collector.take(this.advance + 1);
        this.steps++;
        this.advance = 0;
      } else {
        yield STOP_BEGIN;
        yield* this.collector.take(this.advance);
        yield STOP_END;
        this.collector.reposition(this.advance);
        this.steps = this.advance = 0;
        yield* this.step(ch);
      }
    } else if (this.steps > BODY) {
      if (!isWhitespace(ch)) {
        yield* this.collector.take(this.advance + 1);
        this.steps++
        this.advance = 0;
      } else {
        yield STOP_END;
        this.collector.reposition(this.advance);
        this.steps = this.advance = 0;
        yield* this.step(ch);
      }
    }
  }
}
