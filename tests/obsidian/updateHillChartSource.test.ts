import { describe, it, expect } from 'vitest';
import { updateHillChartSource } from '../../src/obsidian/updateHillChartSource';
import { HillPosition } from '../../src/model/hillPosition';

function pos(n: number): HillPosition {
  return HillPosition.fromPercent(n);
}

describe('updateHillChartSource - shorthand form', () => {
  it('updates position of the first dot (shorthand single dot)', () => {
    const source = 'dots:\n  - 50: My Task';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe('dots:\n  - 75: My Task');
  });

  it('updates the correct dot by index when multiple shorthand dots exist', () => {
    const source = 'dots:\n  - 25: Alpha\n  - 50: Beta\n  - 75: Gamma';
    const result = updateHillChartSource(source, 1, pos(60));
    expect(result).toBe('dots:\n  - 25: Alpha\n  - 60: Beta\n  - 75: Gamma');
  });

  it('preserves [[wiki link]] label verbatim', () => {
    const source = 'dots:\n  - 30: "[[My Note]]"';
    const result = updateHillChartSource(source, 0, pos(80));
    expect(result).toBe('dots:\n  - 80: "[[My Note]]"');
  });

  it('handles position-only shorthand (no label, trailing colon)', () => {
    const source = 'dots:\n  - 50:';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe('dots:\n  - 75:');
  });

  it('handles shorthand with no label and no colon', () => {
    const source = 'dots:\n  - 50';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe('dots:\n  - 75');
  });

  it('updates last dot when index points to last', () => {
    const source = 'dots:\n  - 10: A\n  - 20: B\n  - 30: C';
    const result = updateHillChartSource(source, 2, pos(99));
    expect(result).toBe('dots:\n  - 10: A\n  - 20: B\n  - 99: C');
  });

  it('handles decimal position values', () => {
    const source = 'dots:\n  - 33.5: Decimal Position';
    const result = updateHillChartSource(source, 0, pos(66));
    expect(result).toBe('dots:\n  - 66: Decimal Position');
  });
});

describe('updateHillChartSource - mapping form', () => {
  it('updates position in mapping form where position is on the dash line', () => {
    const source = 'dots:\n  - position: 50\n    label: Foo';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe('dots:\n  - position: 75\n    label: Foo');
  });

  it('updates position in mapping form where position is on its own line', () => {
    const source = 'dots:\n  -\n    position: 50\n    label: Foo';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe('dots:\n  -\n    position: 75\n    label: Foo');
  });

  it('updates the correct dot by index in mapping form with multiple items', () => {
    const source = 'dots:\n  - position: 10\n    label: A\n  - position: 50\n    label: B';
    const result = updateHillChartSource(source, 1, pos(80));
    expect(result).toBe('dots:\n  - position: 10\n    label: A\n  - position: 80\n    label: B');
  });
});

describe('updateHillChartSource - surrounding YAML and structure', () => {
  it('preserves chart: block above dots:', () => {
    const source = 'chart:\n  curve:\n    stroke: red\ndots:\n  - 50: My Task';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe('chart:\n  curve:\n    stroke: red\ndots:\n  - 75: My Task');
  });

  it('preserves comments inside the dots block', () => {
    const source = 'dots:\n  # first dot\n  - 50: My Task';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe('dots:\n  # first dot\n  - 75: My Task');
  });

  it('preserves CRLF line endings throughout', () => {
    const source = 'dots:\r\n  - 10: A\r\n  - 20: B\r\n  - 30: C';
    const result = updateHillChartSource(source, 1, pos(55));
    expect(result).toBe('dots:\r\n  - 10: A\r\n  - 55: B\r\n  - 30: C');
  });
});

describe('updateHillChartSource - mapping form with style sub-block', () => {
  it('preserves style: sub-block verbatim when updating position', () => {
    const source = [
      'dots:',
      '  - position: 50',
      '    label: Foo',
      '    style:',
      '      color: red',
    ].join('\n');

    const result = updateHillChartSource(source, 0, pos(75));

    expect(result).toBe([
      'dots:',
      '  - position: 75',
      '    label: Foo',
      '    style:',
      '      color: red',
    ].join('\n'));
  });
});

describe('updateHillChartSource - edge cases / no-ops', () => {
  it('specIndex out-of-bounds → source unchanged', () => {
    const source = 'dots:\n  - 50: My Task';
    const result = updateHillChartSource(source, 5, pos(75));
    expect(result).toBe(source);
  });

  it('flow-style array → source unchanged (unsupported)', () => {
    const source = 'dots: [{position: 50, label: My Task}]';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe(source);
  });

  it('no dots: key → source unchanged', () => {
    const source = 'chart:\n  curve:\n    stroke: red';
    const result = updateHillChartSource(source, 0, pos(75));
    expect(result).toBe(source);
  });

  it('empty source → source unchanged', () => {
    const result = updateHillChartSource('', 0, pos(75));
    expect(result).toBe('');
  });
});
