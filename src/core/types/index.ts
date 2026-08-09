export interface PlacedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MasterCanvasStatus {
  hasImage: boolean;
  sourceFileName: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  placedRect: PlacedRect | null;
}

/**
 * Structural subset of the DOM `ImageData` shape. Kept as our own interface
 * (rather than depending on the `ImageData` global) so pixel-buffer algorithms
 * in core/ stay usable and testable outside a browser/DOM environment.
 */
export interface PixelBuffer {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}
