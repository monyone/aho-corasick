import { STOP_BEGIN, STOP_END, type Stop, type StopFilter } from "../base.mts";
import Concat from "./concat.mts";
import Collector from "../collector.mts";

export type MarkdownStopFilterOption = {
  heading: boolean;
  code: boolean;
}
export const MarkdownStopFilterOption = {
  from(option?: Partial<MarkdownStopFilterOption>): MarkdownStopFilterOption {
    return {
      heading: option?.heading ?? true,
      code: option?.code ?? true,
    };
  }
}

const State = {
  NORMAL: 'NORMAL',
  HEADING_BEGIN: 'HEADING_BEGIN',
  HEADING_INPROGRESS: 'HEADING_INPROGRESS',
  FENCE_CODE_OR_INLINE_CODE_BEGIN: 'FENCE_CODE_OR_INLINE_CODE_BEGIN',
  INLINE_CODE_BEGIN: 'INLINE_CODE_BEGIN',
  INLINE_CODE_END: 'INLINE_CODE_END',
  FENCE_CODE_BEGIN: 'FENCE_CODE_BEGIN',
  INLINE_CODE_CANDIDATE: 'INLINE_CODE_CANDIDATE',
  FENCE_CODE_CANDIDATE: 'FENCE_CODE_CANDIDATE',
  FENCE_CODE_END: 'FENCE_CODE_END',
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
  private code_char: `~` | `\`` | null = null;
  private code_open_level: number = 0;
  private code_close_level: number = 0;

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
      case State.HEADING_INPROGRESS: this.stepHeadingInprogress(ch, out); break;
      case State.FENCE_CODE_OR_INLINE_CODE_BEGIN: this.stepFenceCodeOrInlineCodeBegin(ch, out); break;
      case State.INLINE_CODE_BEGIN: this.stepInlineCodeBegin(ch, out); break;
      case State.FENCE_CODE_BEGIN: this.stepFenceCodeBegin(ch, out); break;
      case State.INLINE_CODE_CANDIDATE: this.stepInlineCodeCandidate(ch, out); break;
      case State.FENCE_CODE_CANDIDATE: this.stepFenceCodeCandidate(ch, out); break;
      case State.INLINE_CODE_END: this.stepInlineCodeEnd(ch, out); break;
      case State.FENCE_CODE_END: this.stepFenceCodeEnd(ch, out); break;
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
      case '`': {
        if (!this.option.code) {
          this.steps = 0;
        } else if (this.is_new_line) {
          this.steps += 1;
          this.code_char = '`';
          this.code_open_level = 1;
          this.state = State.FENCE_CODE_OR_INLINE_CODE_BEGIN;
        } else {
          this.steps += 1;
          this.code_char = '`';
          this.code_open_level = 1;
          this.state = State.INLINE_CODE_BEGIN;
        }
        break;
      }
      case '~': {
        if (!this.option.code) {
          this.steps = 0;
        } else if (this.is_new_line) {
          this.steps += 1;
          this.code_char = '~';
          this.code_open_level = 1;
          this.state = State.FENCE_CODE_BEGIN;
        } else {
          this.steps = 0;
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

  public stepInlineCodeBegin(ch: string, _: Concat<string | Stop>): void {
    this.advance += 1;
    if (ch === this.code_char) {
      this.steps += 1;
      this.code_open_level += 1;
    } else {
      this.steps += 1;
      this.state = State.INLINE_CODE_CANDIDATE;
    }
  }

  public stepFenceCodeBegin(ch: string, out: Concat<string | Stop>): void {
    this.advance += 1;
    if (ch === this.code_char) {
      this.steps += 1;
      this.code_open_level += 1;
    } else if (this.code_open_level >= 3) {
      this.steps += 1;
      out.push(this.collector.take((this.advance - this.steps)));
      out.push(STOP_BEGIN);
      this.advance = this.steps;
      this.steps = 0;
      this.detected = true;
      this.state = State.FENCE_CODE_CANDIDATE;
    } else {
      this.steps = 0;
      this.state = State.NORMAL;
    }
  }

  public stepFenceCodeOrInlineCodeBegin(ch: string, out: Concat<string | Stop>): void {
    this.advance += 1;
    this.steps += 1;
    if (ch === this.code_char) {
      this.code_open_level += 1;
    } else if (this.code_open_level <= 2) {
      this.state = State.INLINE_CODE_CANDIDATE;
    } else {
      out.push(this.collector.take((this.advance - this.steps)));
      out.push(STOP_BEGIN);
      this.advance = this.steps;
      this.steps = 0;
      this.detected = true;
      this.state = State.FENCE_CODE_CANDIDATE;
    }
  }

  public stepInlineCodeCandidate(ch: string, _: Concat<string | Stop>): void {
    this.steps += 1;
    this.advance += 1;
    if (ch === this.code_char) {
      this.code_close_level = 1;
      this.state = State.INLINE_CODE_END;
    }
  }

  public stepFenceCodeCandidate(ch: string, _: Concat<string | Stop>): void {
    this.advance += 1;
    if (this.is_new_line && ch === this.code_char) {
      this.code_close_level = 1;
      this.state = State.FENCE_CODE_END;
    }
  }

  public stepInlineCodeEnd(ch: string, out: Concat<string | Stop>): void {
    if (ch === this.code_char) {
      this.advance += 1;
      this.steps += 1;
      this.code_close_level += 1;
    } else if (this.code_open_level === this.code_close_level) {
      out.push(this.collector.take((this.advance - this.steps)));
      out.push(STOP_BEGIN);
      out.push(this.collector.take(this.steps));
      out.push(STOP_END);
      this.advance = 0;
      this.steps = 0;
      this.state = State.NORMAL;
      return this.stepNormal(ch, out);
    } else {
      this.advance += 1;
      this.steps += 1;
      this.state = State.INLINE_CODE_CANDIDATE;
    }
  }

  public stepFenceCodeEnd(ch: string, out: Concat<string | Stop>): void {
    this.advance += 1;
    if (ch === this.code_char) {
      this.code_close_level += 1;
    } else if (this.code_open_level <= this.code_close_level && ch === '\n') {
      out.push(this.collector.take((this.advance)));
      out.push(STOP_END);
      this.advance = this.steps = 0
      this.detected = false;
      this.state = State.NORMAL;
    } else {
      this.state = State.FENCE_CODE_CANDIDATE;
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
