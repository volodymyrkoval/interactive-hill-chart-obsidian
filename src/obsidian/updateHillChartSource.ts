import type { HillPosition } from '../model/hillPosition';

/** The inclusive-start / exclusive-end line range of a single dot item. */
interface DotsBlockBoundary {
  startLine: number;
  endLine: number;
}

// Shorthand form on the dash line: `  - 50: My Task` / `  - 50` / `  - 50:`
const matchShorthandDash = /^(?<prefix>\s*-\s*)(?<pos>\d+(?:\.\d+)?)(?<suffix>(\s*:.*)?)$/;

// Mapping form with `position:` on the dash line: `  - position: 50`
const matchDashPositionKey = /^(?<prefix>\s*-\s*position:\s*)(?<pos>\d+(?:\.\d+)?)(?<suffix>\s*)$/;

// Mapping form with `position:` on a subsequent indented line: `    position: 50`
const matchQuotedString = /^(?<prefix>\s*position:\s*)(?<pos>\d+(?:\.\d+)?)(?<suffix>\s*)$/;

/**
 * Pure function: rewrites the position value of the dot at `specIndex` inside
 * a YAML hill-chart block, preserving all surrounding text verbatim.
 *
 * Uses a line-based rewrite rather than YAML round-trip to avoid reformatting
 * comments, quoting, and indentation.
 */
export function updateHillChartSource(
  source: string,
  specIndex: number,
  newPosition: HillPosition,
): string {
  const newPositionNumber = newPosition.toPercent();
  // Split on \n; each line may have a trailing \r (CRLF), which we strip for
  // processing and restore on output.
  const rawLines = source.split('\n');
  const lines = rawLines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));

  const dotsLineIndex = findDotsKeyLine(lines);
  if (dotsLineIndex === -1) return source;

  const dotsIndent = indentOf(lines[dotsLineIndex]);
  const itemStarts = findItemStartLines(lines, dotsLineIndex, dotsIndent);

  if (specIndex >= itemStarts.length) return source;

  const boundary: DotsBlockBoundary = {
    startLine: itemStarts[specIndex],
    endLine:
      specIndex + 1 < itemStarts.length ? itemStarts[specIndex + 1] : findDotsBlockEnd(lines, dotsLineIndex, dotsIndent),
  };

  const rewritten = rewritePositionInItem(lines, boundary, newPositionNumber);
  if (rewritten === null) return source;

  const { lineIndex, newLine } = rewritten;
  const hasCR = rawLines[lineIndex].endsWith('\r');
  const updatedRawLines = rawLines.map((rawLine, i) => {
    if (i !== lineIndex) return rawLine;
    return hasCR ? newLine + '\r' : newLine;
  });

  return updatedRawLines.join('\n');
}

/** Returns the 0-based index of the top-level `dots:` line, or -1. */
function findDotsKeyLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    // Match `dots:` at indent 0 (top-level key), allowing optional trailing whitespace.
    // A flow-style `dots: [...]` won't match because it has content after the colon.
    if (/^dots:\s*$/.test(lines[i])) return i;
  }
  return -1;
}

/** Returns true if the line is blank or a comment. */
function isBlankOrComment(line: string): boolean {
  return line.trim() === '' || line.trimStart().startsWith('#');
}

/** Returns the 0-based indices of each array item start line within the dots block. */
function findItemStartLines(lines: string[], dotsLineIndex: number, dotsIndent: number): number[] {
  const starts: number[] = [];
  for (let i = dotsLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (isBlankOrComment(line)) continue;
    const indent = indentOf(line);
    // A line at dotsIndent or less and not blank signals end of the dots block.
    if (indent <= dotsIndent) break;
    if (line.trimStart().startsWith('-')) {
      starts.push(i);
    }
  }
  return starts;
}

/**
 * Returns the line index just past the last line of the dots block.
 * "Past" means the first line whose indent is ≤ dotsIndent (or end of file).
 */
function findDotsBlockEnd(lines: string[], dotsLineIndex: number, dotsIndent: number): number {
  for (let i = dotsLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (isBlankOrComment(line)) continue;
    if (indentOf(line) <= dotsIndent) return i;
  }
  return lines.length;
}

/**
 * Finds the position line within the item range [boundary.startLine, boundary.endLine) and
 * returns the index + new line text. Returns null if no position line found.
 */
function rewritePositionInItem(
  lines: string[],
  boundary: DotsBlockBoundary,
  newPosition: number,
): { lineIndex: number; newLine: string } | null {
  const { startLine, endLine } = boundary;
  const dashLine = lines[startLine];

  // Shorthand on the dash line: `  - 50: My Task` or `  - 50` or `  - 50:`
  const shorthandMatch = dashLine.match(matchShorthandDash);
  if (shorthandMatch?.groups) {
    const { prefix, suffix } = shorthandMatch.groups;
    return { lineIndex: startLine, newLine: `${prefix}${newPosition}${suffix}` };
  }

  // Mapping form with position on the dash line: `  - position: 50`
  const dashMappingMatch = dashLine.match(matchDashPositionKey);
  if (dashMappingMatch?.groups) {
    const { prefix, suffix } = dashMappingMatch.groups;
    return { lineIndex: startLine, newLine: `${prefix}${newPosition}${suffix}` };
  }

  // Mapping form with position on a subsequent line within the item
  for (let i = startLine + 1; i < endLine; i++) {
    const posMatch = lines[i].match(matchQuotedString);
    if (posMatch?.groups) {
      const { prefix, suffix } = posMatch.groups;
      return { lineIndex: i, newLine: `${prefix}${newPosition}${suffix}` };
    }
  }

  return null;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}
