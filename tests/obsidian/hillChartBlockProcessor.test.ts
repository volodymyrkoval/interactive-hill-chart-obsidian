import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHillChartBlockProcessor } from '../../src/obsidian/hillChartBlockProcessor';
import type { Logger } from '../../src/app/logger';
import type { PositionWriter } from '../../src/app/positionWriter';
import type { Result, WriteError } from '../../src/types';
import type { WriteHillChartPositionRequest } from '../../src/app/positionWriter';
import type { App, MarkdownPostProcessorContext, MarkdownSectionInformation } from 'obsidian';

function makeWriter(
  result: Result<void, WriteError> = { ok: true, value: undefined },
): { writer: PositionWriter; writeMock: ReturnType<typeof vi.fn> } {
  const writeMock = vi.fn().mockResolvedValue(result);
  return {
    writer: {
      write: writeMock as unknown as (
        req: WriteHillChartPositionRequest,
      ) => Promise<Result<void, WriteError>>,
    },
    writeMock,
  };
}

// Minimal App mock
function makeApp(): App {
  return {
    workspace: {
      openLinkText: vi.fn(),
    },
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue({ path: 'test.md' }),
      read: vi.fn().mockResolvedValue(''),
      modify: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as App;
}

// Minimal MarkdownPostProcessorContext mock
function makeCtx(sectionInfo?: MarkdownSectionInformation): {
  ctx: MarkdownPostProcessorContext;
  addChildMock: ReturnType<typeof vi.fn>;
} {
  const addChildMock = vi.fn();
  const ctx = {
    sourcePath: 'test.md',
    getSectionInfo: vi.fn().mockReturnValue(sectionInfo ?? null),
    addChild: addChildMock,
  } as unknown as MarkdownPostProcessorContext;
  return { ctx, addChildMock };
}

describe('createHillChartBlockProcessor', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentElement) container.parentElement.removeChild(container);
    vi.clearAllMocks();
  });

  it('renders an SVG into the container element', () => {
    const app = makeApp();
    const { ctx } = makeCtx();
    const { writer } = makeWriter();
    const processor = createHillChartBlockProcessor(app, writer);

    processor('dots:\n  - 50: My Task', container, ctx);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('calls ctx.addChild with a MarkdownRenderChild instance', () => {
    const app = makeApp();
    const { ctx, addChildMock } = makeCtx();
    const { writer } = makeWriter();
    const processor = createHillChartBlockProcessor(app, writer);

    processor('dots:\n  - 50: Task', container, ctx);

    expect(addChildMock).toHaveBeenCalledOnce();
    const child = addChildMock.mock.calls[0][0];
    // Should be a MarkdownRenderChild — has containerEl property
    expect(child).toHaveProperty('containerEl');
  });

  it('HillChartChild.onunload() removes the SVG from the container', () => {
    const app = makeApp();
    const { ctx, addChildMock } = makeCtx();
    const { writer } = makeWriter();
    const processor = createHillChartBlockProcessor(app, writer);

    processor('dots:\n  - 50: Task', container, ctx);

    expect(container.querySelector('svg')).not.toBeNull();

    const child = addChildMock.mock.calls[0][0];
    // Simulate Obsidian calling onunload (destroy the render child)
    child.onunload();

    expect(container.querySelector('svg')).toBeNull();
  });

  it('onPositionChange callback is wired to renderer (circle gets cursor:grab)', () => {
    const app = makeApp();
    const { ctx } = makeCtx();
    const { writer } = makeWriter();
    const processor = createHillChartBlockProcessor(app, writer);

    processor('dots:\n  - 50: Draggable', container, ctx);

    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();
    expect((circle as SVGElement).style.cursor).toBe('grab');
  });

  it('calls injected logger.warn when PositionWriter.write fails', async () => {
    const app = makeApp();
    const sectionInfo: MarkdownSectionInformation = {
      text: 'full document content',
      lineStart: 1,
      lineEnd: 3,
    };
    const { ctx } = makeCtx(sectionInfo);
    const warnMock = vi.fn();
    const logger: Logger = { warn: warnMock };
    const { writer } = makeWriter({ ok: false, error: { kind: 'StaleContent' } });
    const processor = createHillChartBlockProcessor(app, writer, logger);

    processor('dots:\n  - 50: My Task', container, ctx);

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    svgPoint.x = 300;
    svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    await vi.waitFor(() => expect(warnMock).toHaveBeenCalled());
    expect(warnMock).toHaveBeenCalledWith(
      '[hill-chart] writeHillChartPosition failed',
      { error: { kind: 'StaleContent' } },
    );
  });

  it('write callback passes the original source string as expectedInnerText', async () => {
    const app = makeApp();
    const sectionInfo: MarkdownSectionInformation = {
      text: 'full document content',
      lineStart: 1,
      lineEnd: 3,
    };
    const { ctx } = makeCtx(sectionInfo);
    const { writer, writeMock } = makeWriter();
    const processor = createHillChartBlockProcessor(app, writer);

    const originalSource = 'dots:\n  - 50: My Task';

    processor(originalSource, container, ctx);

    // Simulate a drag — find the circle and trigger drag events
    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    svgPoint.x = 300;
    svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    // Allow async write to be called
    await vi.waitFor(() => expect(writeMock).toHaveBeenCalled());
    const req = writeMock.mock.calls[0][0] as WriteHillChartPositionRequest;
    // oldContent in the request must equal the original source
    expect(req.oldContent).toBe(originalSource);
  });

  it('uses the injected PositionWriter (not a direct writeHillChartPosition call)', async () => {
    const app = makeApp();
    const sectionInfo: MarkdownSectionInformation = {
      text: 'full document content',
      lineStart: 1,
      lineEnd: 3,
    };
    const { ctx } = makeCtx(sectionInfo);
    const { writer, writeMock } = makeWriter();
    const processor = createHillChartBlockProcessor(app, writer);

    processor('dots:\n  - 50: Task', container, ctx);

    const svg = container.querySelector('svg') as SVGSVGElement;
    const circle = container.querySelector('circle') as SVGCircleElement;
    const svgPoint = { x: 0, y: 0, matrixTransform: vi.fn() };
    svgPoint.matrixTransform.mockImplementation(() => ({ x: svgPoint.x, y: svgPoint.y }));
    svg.createSVGPoint = vi.fn().mockReturnValue(svgPoint);
    svg.getScreenCTM = vi.fn().mockReturnValue({ inverse: vi.fn().mockReturnValue({}) });

    circle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    svgPoint.x = 300;
    svgPoint.y = 100;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));
    window.dispatchEvent(new MouseEvent('mouseup'));

    await vi.waitFor(() => expect(writeMock).toHaveBeenCalled());
  });
});
