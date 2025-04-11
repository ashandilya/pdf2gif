'use server';

import { PDFDocument } from 'pdf-lib';
import { GIFEncoder, quantize } from 'gifenc';

/**
 * Represents the configuration options for GIF generation.
 */
export interface GifConfig {
  /**
   * The frame rate of the GIF.
   */
  frameRate: number;
  /**
   * The resolution of the GIF.
   */
  resolution: string;
  /**
   * Whether the GIF should loop.
   */
  looping: boolean;
}

async function readPdf(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Asynchronously generates a GIF from a PDF file.
 *
 * @param pdfFile The PDF file to convert.
 * @param config The configuration options for GIF generation.
 * @returns A promise that resolves to a Blob containing the generated GIF file.
 */
export async function generateGifFromPdf(pdfFile: File, config: GifConfig): Promise<Blob> {
  try {
    const pdfBytes = await readPdf(pdfFile);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const numPages = pdfDoc.getPages().length;

    const width = parseInt(config.resolution.split('x')[0]);
    const height = parseInt(config.resolution.split('x')[1]);
    const frameDelay = Math.round(100 / config.frameRate);

    const encoder = new GIFEncoder(); // changed from GIFEncoder()
    encoder.setFrameRate(config.frameRate);
    encoder.setRepeat(config.looping ? 0 : -1);
    encoder.setSize(width, height);
    encoder.start();

    for (let i = 0; i < numPages; i++) {
      const page = pdfDoc.getPages()[i];
      const pngBytes = await page.toPngBytes();

      // Create an Image object from the PNG bytes.
      const img = new Image();
      img.src = `data:image/png;base64,${btoa(String.fromCharCode(...pngBytes))}`;

      await new Promise<void>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const quantized = quantize(imageData.data, 256);
            encoder.addFrame(quantized.indexed);
          }
          resolve();
        };
      });
    }

    encoder.finish();
    const buffer = encoder.bytes();
    return new Blob([buffer], {type: 'image/gif'});

  } catch (error: any) {
    console.error("Error generating GIF:", error);
    throw new Error(`Error generating GIF: ${error.message || error}`);
  }
}
