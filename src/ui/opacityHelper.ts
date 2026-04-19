export function applyResolvedOpacity(circle: SVGCircleElement, opacity?: number): void {
  if (opacity === undefined) {
    circle.removeAttribute('fill-opacity');
  } else {
    circle.setAttribute('fill-opacity', `${opacity}`);
  }
}
