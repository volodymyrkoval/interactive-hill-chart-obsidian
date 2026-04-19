// CSS named colors (full ~150-color whitelist)
const CSS_NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
  'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood',
  'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
  'cornsilk', 'crimson', 'cyan',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgrey',
  'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange',
  'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
  'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
  'firebrick', 'floralwhite', 'forestgreen', 'fuchsia',
  'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray',
  'grey', 'green', 'greenyellow',
  'honeydew', 'hotpink',
  'indianred', 'indigo', 'ivory',
  'khaki',
  'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue',
  'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgrey',
  'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue',
  'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime',
  'limegreen', 'linen',
  'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid',
  'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
  'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin',
  'navajowhite', 'navy',
  'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
  'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip',
  'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
  'red', 'rosybrown', 'royalblue',
  'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey',
  'snow', 'springgreen', 'steelblue',
  'tan', 'teal', 'thistle', 'tomato', 'turquoise',
  'violet',
  'wheat', 'white', 'whitesmoke',
  'yellow', 'yellowgreen',
  // Special values
  'transparent', 'currentcolor', 'inherit', 'none',
]);

/**
 * Validates if a string is a valid CSS color value.
 * Accepts: hex (#rgb, #rrggbb, #rgba, #rrggbbaa), rgb(...), rgba(...),
 * hsl(...), hsla(...), var(--...), currentColor, inherit, transparent,
 * and CSS named colors.
 */
export function isValidCssColor(value: string): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;

  const trimmed = value.trim().toLowerCase();

  // CSS named colors
  if (CSS_NAMED_COLORS.has(trimmed)) return true;

  // CSS custom property: var(--...)
  if (/^var\(--[\w-]+(\s*,\s*[^)]+)?\)$/.test(trimmed)) return true;

  // Hex colors: #rgb, #rrggbb, #rgba, #rrggbbaa
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return true;

  // rgb(...) or rgba(...)
  if (/^rgba?\s*\(\s*/.test(trimmed)) {
    return isValidRgbColor(trimmed);
  }

  // hsl(...) or hsla(...)
  if (/^hsla?\s*\(\s*/.test(trimmed)) {
    return isValidHslColor(trimmed);
  }

  return false;
}

/**
 * Validates rgb/rgba function format.
 * Examples: rgb(0, 0, 0), rgba(255, 128, 64, 0.5)
 */
function isValidRgbColor(color: string): boolean {
  const match = color.match(/^rgba?\s*\(\s*([^)]+)\s*\)$/);
  if (!match) return false;

  const args = match[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '');

  // Must have 3 or 4 arguments
  if (args.length < 3 || args.length > 4) return false;

  // First 3 must be 0-255
  for (let i = 0; i < 3; i++) {
    const val = Number(args[i]);
    if (!Number.isFinite(val) || val < 0 || val > 255) return false;
  }

  // If 4th arg exists, must be 0-1
  if (args.length === 4) {
    const alpha = Number(args[3]);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return false;
  }

  return true;
}

/**
 * Validates hsl/hsla function format.
 * Examples: hsl(0, 100%, 50%), hsla(240, 100%, 50%, 0.8)
 */
function isValidHslColor(color: string): boolean {
  const match = color.match(/^hsla?\s*\(\s*([^)]+)\s*\)$/);
  if (!match) return false;

  const args = match[1]
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '');

  // Must have 3 or 4 arguments
  if (args.length < 3 || args.length > 4) return false;

  // Hue: 0-360 (no units)
  const hue = Number(args[0]);
  if (!Number.isFinite(hue) || hue < 0 || hue > 360) return false;

  // Saturation: 0-100%
  const satMatch = args[1].match(/^([0-9.]+)\s*%?$/);
  if (!satMatch) return false;
  const sat = Number(satMatch[1]);
  if (!Number.isFinite(sat) || sat < 0 || sat > 100) return false;

  // Lightness: 0-100%
  const lightMatch = args[2].match(/^([0-9.]+)\s*%?$/);
  if (!lightMatch) return false;
  const light = Number(lightMatch[1]);
  if (!Number.isFinite(light) || light < 0 || light > 100) return false;

  // If 4th arg exists (alpha), must be 0-1
  if (args.length === 4) {
    const alpha = Number(args[3]);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return false;
  }

  return true;
}

/**
 * Validates that a number is finite and non-negative.
 */
export function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Validates that a number is a valid opacity (finite number in [0, 1]).
 */
export function isOpacity(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
