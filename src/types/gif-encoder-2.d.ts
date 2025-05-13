declare module 'gif-encoder-2' {
  export default class GIFEncoder {
    constructor(width: number, height: number, algorithm?: string, useOptimizer?: boolean);
    start(): void;
    setRepeat(repeat: number): void;
    setDelay(delay: number): void;
    setQuality(quality: number): void;
    addFrame(context: CanvasRenderingContext2D): void;
    finish(): void;
    out: {
      getData(): Uint8Array;
    };
  }
} 