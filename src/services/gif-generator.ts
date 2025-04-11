'use server';

import { PDFDocument } from 'pdf-lib';

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
  return new Promise(async (resolve, reject) => {
    try {
      const pdfBytes = await readPdf(pdfFile);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const numPages = pdfDoc.getPages().length;

      const width = parseInt(config.resolution.split('x')[0]);
      const height = parseInt(config.resolution.split('x')[1]);
      const frameDelay = Math.round(1000 / config.frameRate); // Delay in milliseconds

      // Dynamically import GIF to ensure it runs on the client-side
      const GIF = (await import('gif.js')).default;

      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: width,
        height: height,
        debug: true,
        repeat: config.looping ? 0 : -1,
      });

      for (let i = 0; i < numPages; i++) {
        const page = pdfDoc.getPages()[i];
        const pngBytes = await page.toPngBytes();

        const img = new Image();
        img.src = `data:image/png;base64,${btoa(String.fromCharCode(...pngBytes))}`;

        await new Promise<void>((resolveImg) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              gif.addFrame(ctx, { delay: frameDelay });
            }
            resolveImg();
          };
          img.onerror = (error) => {
            reject(error);
          };
        });
      }

      gif.on('finished', function(blob) {
        resolve(blob);
      });

      gif.on('abort', function() {
        reject(new Error('GIF generation aborted.'));
      });

      gif.render();
    } catch (error: any) {
      console.error("Error generating GIF:", error);
      reject(new Error(`Error generating GIF: ${error.message || error}`));
    }
  });
}
