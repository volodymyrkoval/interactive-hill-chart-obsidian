export interface CurveStyle {
  stroke?: string;      // default: currentColor
  strokeWidth?: number; // default: 2
  fill?: string;        // default: "none"
}

export interface BaselineStyle {
  visible?: boolean;    // default: true
  stroke?: string;
  opacity?: number;     // default: 0.3
  strokeWidth?: number; // default: 1
}

export interface DividerStyle {
  visible?: boolean;
  stroke?: string;
  strokeWidth?: number;
  style?: 'line' | 'dots' | 'dashed';
}

export interface SectionLabelStyle {
  label?: string;       // undefined → not rendered
  fontSize?: number;    // default: 12
  color?: string;       // default: currentColor
}

export interface DotStyle {
  color?: string;
  opacity?: number;
  radius?: number;
  fontSize?: number;
  fontColor?: string;
}

export interface ChartStyle {
  curve?: CurveStyle;
  baseline?: BaselineStyle;
  divider?: DividerStyle;
  uphill?: SectionLabelStyle;
  downhill?: SectionLabelStyle;
  dot?: DotStyle;
}

import type { HillPosition } from './hillPosition';
import type { HillChartParseError } from './parseErrors';

export interface HillChartItem {
  position: HillPosition;
  label?: string;
  noteLink?: string;
  style?: DotStyle;
}

export interface HillChartConfig {
  chart?: ChartStyle;
  dots: HillChartItem[];
  errors: HillChartParseError[];
}
