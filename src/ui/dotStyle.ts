import type { DotStyle } from '../model/hillChartConfig';

export function resolveDotStyle(global: DotStyle | undefined, perDot: DotStyle | undefined): DotStyle {
  return {
    color: perDot?.color ?? global?.color,
    opacity: perDot?.opacity ?? global?.opacity,
    radius: perDot?.radius ?? global?.radius,
    fontSize: perDot?.fontSize ?? global?.fontSize,
    fontColor: perDot?.fontColor ?? global?.fontColor,
  };
}
