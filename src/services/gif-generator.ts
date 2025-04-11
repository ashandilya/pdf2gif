'use server';

import { PDFDocument } from 'pdf-lib';
import GIFEncoder from '@gifencoder/gifencoder';

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

    const encoder = new GIFEncoder(width, height);
    encoder.start();
    encoder.setRepeat(config.looping ? 0 : -1);
    encoder.setDelay(frameDelay);
    encoder.setQuality(10);

    for (let i = 0; i < numPages; i++) {
      const page = pdfDoc.getPages()[i];

      // Extract page as PNG
      const pngBytes = await page.toPngBytes();

      // Decode PNG bytes into ImageData
      const blob = new Blob([pngBytes]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Create a canvas and draw the image onto it
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          encoder.addFrame(imageData.data);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = reject;
      });
    }

    encoder.finish();
    const buffer = encoder.out.getData();
    return new Blob([buffer], { type: 'image/gif' });

  } catch (error: any) {
    console.error("Error generating GIF:", error);
    throw new Error(`Error generating GIF: ${error.message || error}`);
  }
}
