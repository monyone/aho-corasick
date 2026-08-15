import { STOP_BEGIN, STOP_END, type Stop, type StopFilter } from "../base.mts";
import Concat from "./concat.mts";
import Collector from "../collector.mts";

const isWhitespace = (ch: string) => ch.length === 1 && /\s/.test(ch);
const SCHEME = "http";
const AFTER_SCHEME = SCHEME.length;
const SEPARATOR = "://";
const SEPARATOR_BASE = SCHEME.length + 1;
const BODY = SEPARATOR_BASE + SEPARATOR.length;

export default class UrlLikeStopFilter implements StopFilter {
  private collector: Collector = new Collector();
  private advance: number = 0;
  private steps: number = 0;
  private progress: number = 0;
  private detected: boolean = false;

  public write(chunk: string): Iterable<string | Stop> {
    this.collector.feed(chunk);

    const concat = new Concat<string | Stop>();
    for (let i = 0; i < chunk.length; i++) {
      this.step(chunk[i], concat);
    }

    if (this.advance - this.steps > 0) {
      concat.push(this.collector.take(this.advance - this.steps));
      this.collector.reposition(this.advance - this.steps);
      this.advance = this.steps;
    }

    return concat;
  }

  public end(): Iterable<string | Stop> {
    const concat = new Concat<string | Stop>();
    concat.push(this.collector.take(this.advance));
    this.collector.reposition(this.advance);
    if (this.detected) { concat.push(STOP_END); }
    this.progress = 0;
    this.steps = 0;
    this.advance = 0;
    this.detected = false;
    return concat;
  }

  public step(ch: string, out: Concat<string | Stop>): void {
    if (this.progress < SCHEME.length) {
      if (ch === SCHEME[this.progress]) {
        this.progress++;
        this.steps++;
        this.advance++;
      } else {
        if (this.progress > 0) {
          this.progress = this.steps = 0;
          return this.step(ch, out);
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
        return this.step(ch, out);
      }
    } else if (this.progress < BODY) {
      if (ch === SEPARATOR[this.progress - SEPARATOR_BASE]) {
        this.steps++;
        this.progress++;
        this.advance++;
      } else {
        this.progress = this.steps = 0;
        return this.step(ch, out);
      }
    } else if (this.progress === BODY) {
      if (!isWhitespace(ch)) {
        this.advance++;
        this.progress++;
        this.steps++;
        out.push(this.collector.take((this.advance - this.steps)));
        out.push(STOP_BEGIN);
        this.collector.reposition((this.advance - this.steps));
        this.advance = this.steps;
        this.detected = true;
      } else {
        this.progress = this.steps = 0;
        return this.step(ch, out);
      }
    } else if (this.progress > BODY) {
      if (!isWhitespace(ch)) {
        this.advance++;
      } else {
        out.push(this.collector.take((this.advance)));
        out.push(STOP_END);
        this.collector.reposition(this.advance);
        this.progress = this.steps = this.advance = 0;
        this.detected = false;
        return this.step(ch, out);
      }
    }
  }
}
