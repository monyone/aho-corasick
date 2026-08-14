import { STOP_BEGIN, STOP_END, type Stop, type StopFilter } from "../base.mts";
import Collector from "./collector.mts";

export type { StopFilter } from "../base.mts";

const isWhitespace = (ch: string) => ch.length === 1 && /\s/.test(ch);
const SCHEME = "http";
const AFTER_SCHEME = SCHEME.length;
const SEPARATOR = "://";
const SEPARATOR_BASE = SCHEME.length + 1;
const BODY = SEPARATOR_BASE + SEPARATOR.length;

export default class URLLikeStopFilter implements StopFilter {
  private zerolength: boolean = false;
  private collector: Collector = new Collector();
  private advance: number = 0;
  private steps: number = 0;
  private progress: number = 0;
  private detected: boolean = false;

  public constructor(zerolength = false) {
    this.zerolength = zerolength;
  }

  public *write(chunk: string): Iterable<string | Stop> {
    this.collector.feed(chunk);
    for (let i = 0; i < chunk.length; i++) {
      yield* this.step(chunk[i]);
    }
    if (this.progress >= BODY) {
      yield* this.collector.take(this.advance - this.steps);
      this.collector.reposition(this.advance - this.steps);
      this.advance = this.steps;
    }
  }

  public *end(): Iterable<string | Stop> {
    yield* this.collector.take(this.advance);
    this.collector.reposition(this.advance);
    if (this.detected) {
      yield STOP_END;
    }
    this.progress = 0;
    this.steps = 0;
    this.advance = 0;
    this.detected = false;
  }

  public *step(ch: string): Iterable<string | Stop>{
    if (this.progress < SCHEME.length) {
      if (ch === SCHEME[this.progress]) {
        this.progress++;
        this.steps++;
        this.advance++;
      } else {
        if (this.progress > 0) {
          this.progress = this.steps = 0;
          yield* this.step(ch);
        } else {
          this.progress = this.steps = 0;
          this.advance++;
        }
      }
    } else if (this.progress === AFTER_SCHEME) {
      if (ch === 's') {
        this.progress = SEPARATOR_BASE
        this.steps++;
        this.advance++;
      } else if (ch === SEPARATOR[0]) {
        this.progress = SEPARATOR_BASE + 1;
        this.steps++;
        this.advance++;
      } else {
        this.progress = this.steps = 0;
        yield* this.step(ch);
      }
    } else if (this.progress < BODY) {
      if (ch === SEPARATOR[this.progress - SEPARATOR_BASE]) {
        if (this.progress === BODY - 1 && this.zerolength) {
          this.progress++
          this.steps++;
          this.advance++;
          yield* this.collector.take((this.advance - this.steps));
          yield STOP_BEGIN;
          this.collector.reposition((this.advance - this.steps));
          this.advance = this.steps;
          this.detected = true;
        } else {
          this.steps++;
          this.progress++;
          this.advance++;
        }
      } else {
        this.progress = this.steps = 0;
        yield* this.step(ch);
      }
    } else if (this.progress === BODY) {
      if (!isWhitespace(ch)) {
        this.advance++;
        this.progress++;
        if (!this.zerolength) {
          this.steps++;
          yield* this.collector.take((this.advance - this.steps));
          yield STOP_BEGIN;
          this.collector.reposition((this.advance - this.steps));
          this.advance = this.steps;
          this.detected = true;
        }
      } else if (this.detected) {
        yield* this.collector.take(this.advance);
        yield STOP_END;
        this.collector.reposition(this.advance);
        this.progress = this.steps = this.advance = 0;
        this.detected = false;
        yield* this.step(ch);
      } else {
        this.progress = this.steps = 0;
        yield* this.step(ch);
      }
    } else if (this.progress > BODY) {
      if (!isWhitespace(ch)) {
        this.advance++;
      } else {
        yield* this.collector.take(this.advance);
        yield STOP_END;
        this.collector.reposition(this.advance);
        this.progress = this.steps = this.advance = 0;
        this.detected = false;
        yield* this.step(ch);
      }
    }
  }
}
