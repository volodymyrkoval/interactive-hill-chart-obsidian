export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type WriteError =
  | { kind: 'SectionInfoMissing' }
  | { kind: 'FileNotFound'; path: string }
  | { kind: 'NotATFile'; path: string }
  | { kind: 'StaleContent' }
  | { kind: 'ReadFailed'; cause: unknown }
  | { kind: 'WriteFailed'; cause: unknown };
