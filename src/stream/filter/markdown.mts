import { STOP_BEGIN, STOP_END, type Stop, type StopFilter } from "../base.mts";
import Concat from "./concat.mts";
import Collector from "../collector.mts";

export type MarkdownStopFilterOption = {
  heading: boolean;
}
export const MarkdownStopFilterOption = {
  from(option?: Partial<MarkdownStopFilterOption>): MarkdownStopFilterOption {
    return {
      heading: option?.heading ?? true,
    };
  }
}

const State = {
  NORMAL: 'NORMAL',
  HEADING_BEGIN: 'HEADING_BEGIN',
  HEADING_INPROGRESS: 'HEADING_INPROGRESS',
} as const;
type State = (typeof State)[keyof typeof State];

export default class MarkdownStopFilter implements StopFilter {
  private collector: Collector = new Collector();
  private advance: number = 0;
  private steps: number = 0;
  private detected: boolean = false;
  private state: State = State.NORMAL;
  private option: MarkdownStopFilterOption;

  private is_new_line: boolean = true;

  public constructor(option?: Partial<MarkdownStopFilterOption>) {
    this.option = MarkdownStopFilterOption.from(option);
  }

  public write(chunk: string): Iterable<string | Stop> {
    this.collector.feed(chunk);

    const concat = new Concat<string | Stop>();
    for (let i = 0; i < chunk.length; i++) {
      this.step(chunk[i], concat);
    }

    this.flush(concat);
    return concat;
  }

  private step(ch: string, out: Concat<string | Stop>): void {
    switch (this.state) {
      case State.NORMAL: this.stepNormal(ch, out); break;
      case State.HEADING_BEGIN: this.stepHeadingBegin(ch, out); break;
      case State.HEADING_INPROGRESS: this.stepHeadingInprogress(ch, out); break;;
    }

    this.is_new_line = ch === '\n';
  }

  private stepNormal(ch: string, _: Concat<string | Stop>): void {
    this.advance += 1;
    switch (ch) {
      case '#': {
        if (!this.is_new_line || !this.option.heading) {
          this.steps = 0;
        } else {
          this.state = State.HEADING_BEGIN;
          this.steps += 1;
        }
        break;
      }
      default: {
        this.steps = 0;
        break;
      }
    }
  }

  public stepHeadingBegin(ch: string, out: Concat<string | Stop>): void {
    this.advance += 1;
    if (ch === '#') {
      this.steps += 1;
    } else if (ch === ' ' || ch === '\t') {
      this.steps += 1;
      out.push(this.collector.take((this.advance - this.steps)));
      out.push(STOP_BEGIN);
      this.advance = this.steps;
      this.steps = 0;
      this.detected = true;
      this.state = State.HEADING_INPROGRESS;
    } else {
      this.steps = 0;
      this.state = State.NORMAL;
    }
  }

  public stepHeadingInprogress(ch: string, out: Concat<string | Stop>): void {
    this.advance += 1;
    if (ch === '\n') {
      out.push(this.collector.take(this.advance));
      out.push(STOP_END);
      this.collector.reposition(this.advance);
      this.steps = this.advance = 0;
      this.detected = false;
      this.state = State.NORMAL;
    }
  }

  private flush(output: Concat<string | Stop>): void {
    if (this.advance - this.steps === 0) { return; }
    output.push(this.collector.take(this.advance - this.steps));
    this.collector.reposition(this.advance - this.steps);
    this.advance = this.steps;
  }

  public end(): Iterable<string | Stop> {
    const concat = new Concat<string | Stop>();
    concat.push(this.collector.take(this.advance));
    this.collector.reposition(this.advance);
    if (this.detected) { concat.push(STOP_END); }
    this.steps = 0;
    this.advance = 0;
    this.detected = false;
    this.is_new_line = true;
    return concat;
  }
}
