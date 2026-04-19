export class FencedBlockRegion {
  private readonly lines: string[];
  private readonly trailingNewline: boolean;

  constructor(
    private readonly fullContent: string,
    private readonly startLine: number,
    private readonly endLine: number,
  ) {
    this.trailingNewline = fullContent.endsWith('\n');
    const raw = this.trailingNewline ? fullContent.slice(0, -1) : fullContent;
    this.lines = raw.split('\n');
  }

  readInner(): string {
    return this.lines.slice(this.startLine + 1, this.endLine).join('\n');
  }

  replaceInner(newInner: string): string {
    const before = this.lines.slice(0, this.startLine + 1);
    const after = this.lines.slice(this.endLine);
    const parts = [...before, ...newInner.split('\n'), ...after];
    const joined = parts.join('\n');
    return this.trailingNewline ? joined + '\n' : joined;
  }
}
