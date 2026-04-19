/**
 * Minimal Obsidian mock for Vitest.
 * Only exports what tests actually need as runtime values.
 */

export class Component {
  _children: Component[] = [];

  onload(): void {}
  onunload(): void {}

  addChild<T extends Component>(child: T): T {
    this._children.push(child);
    child.onload();
    return child;
  }

  removeChild<T extends Component>(child: T): T {
    this._children = this._children.filter((c) => c !== child);
    child.onunload();
    return child;
  }

  load(): void {
    this.onload();
  }

  unload(): void {
    this.onunload();
    for (const child of this._children) {
      child.unload();
    }
  }
}

export class MarkdownRenderChild extends Component {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    super();
    this.containerEl = containerEl;
  }
}

export class Plugin extends Component {}

export class TFile {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}
