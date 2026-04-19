import type { Curve } from '../model/curve';
import type { Size } from '../types';
import type {
  ResolvedBaselineStyle,
  ResolvedCurveStyle,
  ResolvedDividerStyle,
  ResolvedSectionLabelStyle,
  ResolvedChartStyle,
} from '../model/chartStyle';
import { SECTION_LABEL_OFFSET } from './visualConstants';

const SVG_NS = 'http://www.w3.org/2000/svg';

const UPHILL_LABEL_X_RATIO = 0.25;
const DOWNHILL_LABEL_X_RATIO = 0.75;

export interface RenderContext {
  svg: SVGSVGElement;
  size: Size;
  baselineY: number;
}

export class ChartChromeRenderer {
  constructor(private ctx: RenderContext) {}

  renderBaseline(style: ResolvedBaselineStyle): void {
    if (!style.visible) return;
    const { svg, size, baselineY } = this.ctx;
    const baseline = document.createElementNS(SVG_NS, 'line');
    baseline.setAttribute('x1', '0');
    baseline.setAttribute('y1', `${baselineY}`);
    baseline.setAttribute('x2', `${size.width}`);
    baseline.setAttribute('y2', `${baselineY}`);
    baseline.setAttribute('stroke', style.stroke);
    baseline.setAttribute('stroke-opacity', `${style.opacity}`);
    baseline.setAttribute('stroke-width', `${style.strokeWidth}`);
    svg.appendChild(baseline);
  }

  renderDivider(curve: Curve, style: ResolvedDividerStyle): void {
    if (!style.visible) return;
    const { svg, size, baselineY } = this.ctx;
    const centerX = size.width / 2;
    const peakY = curve.toSvgPoint(0.5, size).y;
    const dividerEl = document.createElementNS(SVG_NS, 'line');
    dividerEl.setAttribute('x1', `${centerX}`);
    dividerEl.setAttribute('x2', `${centerX}`);
    dividerEl.setAttribute('y1', `${peakY}`);
    dividerEl.setAttribute('y2', `${baselineY}`);
    dividerEl.setAttribute('stroke', style.stroke);
    dividerEl.setAttribute('stroke-width', `${style.strokeWidth}`);
    if (style.style === 'dashed') dividerEl.setAttribute('stroke-dasharray', '8 4');
    else if (style.style === 'dots') {
      dividerEl.setAttribute('stroke-dasharray', '1 8');
      dividerEl.setAttribute('stroke-linecap', 'round');
    }
    svg.appendChild(dividerEl);
  }

  renderCurvePath(curve: Curve, style: ResolvedCurveStyle): void {
    const { svg, size } = this.ctx;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', curve.toSvgPath(size));
    path.setAttribute('fill', style.fill);
    path.setAttribute('stroke', style.stroke);
    path.setAttribute('stroke-width', `${style.strokeWidth}`);
    svg.appendChild(path);
  }

  renderSectionLabels(chartStyle: ResolvedChartStyle): void {
    const { svg, size, baselineY } = this.ctx;
    const y = baselineY + SECTION_LABEL_OFFSET;
    if (chartStyle.uphill.label !== undefined) {
      this.renderSectionLabel(svg, { label: chartStyle.uphill.label, x: size.width * UPHILL_LABEL_X_RATIO, y, style: chartStyle.uphill });
    }
    if (chartStyle.downhill.label !== undefined) {
      this.renderSectionLabel(svg, { label: chartStyle.downhill.label, x: size.width * DOWNHILL_LABEL_X_RATIO, y, style: chartStyle.downhill });
    }
  }

  private renderSectionLabel(svg: SVGSVGElement, spec: { label: string; x: number; y: number; style: ResolvedSectionLabelStyle }): void {
    const text = document.createElementNS(SVG_NS, 'text') as SVGTextElement;
    text.setAttribute('x', `${spec.x}`);
    text.setAttribute('y', `${spec.y}`);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', `${spec.style.fontSize}`);
    text.setAttribute('fill', spec.style.color);
    text.textContent = spec.label;
    svg.appendChild(text);
  }
}
