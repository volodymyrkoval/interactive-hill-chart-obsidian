import type { HillChartParseError } from '../model/parseErrors';

export class ParsePath {
  private constructor(private readonly value: string) {}

  static of(segment: string): ParsePath {
    return new ParsePath(segment);
  }

  child(segment: string): ParsePath {
    return new ParsePath(`${this.value}.${segment}`);
  }

  index(i: number): ParsePath {
    return new ParsePath(`${this.value}[${i}]`);
  }

  toString(): string {
    return this.value;
  }
}

export class ParseContext {
  constructor(
    private readonly parsePath: ParsePath,
    private readonly errors: HillChartParseError[],
  ) {}

  get path(): string {
    return this.parsePath.toString();
  }

  push(error: HillChartParseError): void {
    this.errors.push(error);
  }

  childCtx(segment: string): ParseContext {
    return new ParseContext(this.parsePath.child(segment), this.errors);
  }

  indexCtx(i: number): ParseContext {
    return new ParseContext(this.parsePath.index(i), this.errors);
  }
}
