'use client';

// This file uses pdfjs-dist for PDF rendering and gif.js for GIF encoding.
// Both libraries rely heavily on browser APIs, so this code must run client-side.

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PDFRenderParams } from 'pdfjs-dist/types/display/api';
import type { PDFWorkerParameters } from 'pdfjs-dist/types/display/worker_options';

// Dynamically import GIF.js only on the client side
// We need to ensure gif.js is loaded before calling generateGifFromPdf
let GIF: any = null; // Placeholder for the GIF library constructor

// Configure the PDF.js worker and load GIF.js library once on the client
if (typeof window !== 'undefined') {
    // Set the worker source for pdfjs-dist.
    // IMPORTANT: Ensure 'public/pdf.worker.js' exists and is the correct worker file.
    try {
      (pdfjsLib.GlobalWorkerOptions as PDFWorkerParameters).workerSrc = `/pdf.worker.js`;
    } catch (e) {
        console.error("Error setting pdfjs workerSrc:", e)
    }


    // Dynamically import gif.js library on client
    import('gif.js/dist/gif.js') // Ensure correct path to gif.js main file
        .then(module => {
            if (module && module.default) {
                GIF = module.default;
                 console.log('gif.js loaded successfully.');
            } else {
                 console.error("Failed to load gif.js: Default export not found.", module);
                 // Attempt to use the module directly if default is not present (less common)
                 GIF = module;
                 if (!GIF) {
                     throw new Error("gif.js module loaded but is empty or invalid.");
                 }
            }
           
        }).catch(err => {
            console.error("Failed to dynamically import gif.js:", err);
            // Handle error, maybe disable GIF generation functionality
        });
}

/**
 * Represents the configuration options for GIF generation.
 */
export interface GifConfig {
  /** Frame rate (frames per second). */
  frameRate: number;
  /** Resolution ('original' or 'WIDTHxauto'). */
  resolution: string;
  /** Looping enabled. */
  looping: boolean;
}

/**
 * Asynchronously generates a GIF from a PDF file on the client-side.
 *
 * @param pdfFile The PDF file to convert.
 * @param config The configuration options for GIF generation.
 * @returns A promise that resolves to a Blob containing the generated GIF file.
 */
export async function generateGifFromPdf(pdfFile: File, config: GifConfig): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('generateGifFromPdf can only be called on the client-side.');
  }
  if (!GIF) {
    // Wait a moment and retry, or throw error immediately
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for dynamic import
    if (!GIF) {
       throw new Error("GIF library (gif.js) has not been loaded yet. Please try again.");
    }
  }
   if (!pdfjsLib || !pdfjsLib.getDocument) {
     throw new Error("pdf.js library has not been loaded correctly.");
   }


  const pdfBytes = await pdfFile.arrayBuffer();
  let pdfDoc: PDFDocumentProxy | null = null;
  try {
    pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  } catch(error) {
      console.error("Error loading PDF document:", error);
      if (error instanceof Error && error.message.includes('Invalid PDF')) {
          throw new Error('Invalid PDF file provided.');
      } else if (error instanceof Error && error.message.includes('workerSrc')) {
           throw new Error('Failed to load PDF worker. Ensure public/pdf.worker.js is available.');
      }
      throw new Error('Failed to load PDF document.');
  }

  const numPages = pdfDoc.numPages;

  let targetWidth: number | undefined = undefined;
  let gifWidth: number | undefined = undefined;
  let gifHeight: number | undefined = undefined;

  if (config.resolution !== 'original' && config.resolution.includes('xauto')) {
    targetWidth = parseInt(config.resolution.split('xauto')[0], 10);
    if (isNaN(targetWidth) || targetWidth <= 0) {
      console.warn(`Invalid target width in resolution: ${config.resolution}. Falling back to original.`);
      targetWidth = undefined;
    }
  }

  // Initialize gif.js
  const gifInstance = new GIF({
    workers: 2, // Number of web workers to use
    quality: 10, // Pixel sample interval, lower is better quality but slower
    workerScript: '/gif.worker.js', // Path to the gif.js worker script in public folder
    repeat: config.looping ? 0 : -1, // 0 for loop indefinitely, -1 for no loop
    // width & height will be set based on the first frame
  });

  const frameDelay = Math.max(20, Math.round(1000 / config.frameRate)); // Delay in ms, min 20ms

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const originalViewport = page.getViewport({ scale: 1.0 });

    let scale = 1.0;
    let renderWidth = originalViewport.width;
    let renderHeight = originalViewport.height;

    // Determine render scale and dimensions
    if (targetWidth) {
      scale = targetWidth / originalViewport.width;
      renderWidth = targetWidth;
      renderHeight = originalViewport.height * scale;
    } else if (config.resolution === 'original') {
      scale = 1.0; // Use original size
    } else { // Default fallback (e.g., 500px width) if resolution is malformed
      const defaultWidth = 500;
      scale = defaultWidth / originalViewport.width;
      renderWidth = defaultWidth;
      renderHeight = originalViewport.height * scale;
    }

    // Ensure dimensions are integers and positive
    renderWidth = Math.max(1, Math.floor(renderWidth));
    renderHeight = Math.max(1, Math.floor(renderHeight));

    // Set GIF dimensions based on the first frame
    if (i === 1) {
      gifWidth = renderWidth;
      gifHeight = renderHeight;
      // @ts-ignore - gif.js typings might be incomplete
      gifInstance.options.width = gifWidth;
      // @ts-ignore
      gifInstance.options.height = gifHeight;
    }

    // Create viewport with calculated scale for rendering
    const viewport = page.getViewport({ scale: scale });

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(`Could not get 2D rendering context for page ${i}.`);
    }
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));


    const renderContext: PDFRenderParams = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Add the rendered frame to the GIF
    // If the rendered canvas size doesn't match the target GIF size (set by first frame),
    // create an intermediate canvas to resize/fit.
     let frameToAdd: CanvasImageSource = canvas;

    if (gifWidth && gifHeight && (canvas.width !== gifWidth || canvas.height !== gifHeight)) {
        // console.warn(`Frame ${i} size (${canvas.width}x${canvas.height}) differs from GIF size (${gifWidth}x${gifHeight}). Resizing/Fitting.`);
        const sizedCanvas = document.createElement('canvas');
        sizedCanvas.width = gifWidth;
        sizedCanvas.height = gifHeight;
        const sizedContext = sizedCanvas.getContext('2d');
        if (!sizedContext) {
             console.error(`Could not get 2D context for resized canvas on frame ${i}. Skipping resize.`);
        } else {
            // Optional: Fill background if pages might be transparent or smaller than GIF size
            // sizedContext.fillStyle = '#FFFFFF'; // Example: White background
            // sizedContext.fillRect(0, 0, gifWidth, gifHeight);

            // Draw the rendered page onto the target-sized canvas (fit and center)
            const drawRatio = Math.min(gifWidth / canvas.width, gifHeight / canvas.height);
            const drawnWidth = canvas.width * drawRatio;
            const drawnHeight = canvas.height * drawRatio;
            const offsetX = (gifWidth - drawnWidth) / 2;
            const offsetY = (gifHeight - drawnHeight) / 2;

            sizedContext.drawImage(canvas, offsetX, offsetY, drawnWidth, drawnHeight);
            frameToAdd = sizedCanvas; // Use the resized canvas as the frame
        }

    }

    // Add the final frame (original or resized) to the GIF instance
    gifInstance.addFrame(frameToAdd, { delay: frameDelay, copy: true }); // copy: true is important!
  }

  // Cleanup PDF document
  await pdfDoc.destroy();

  // Return a promise that resolves with the GIF Blob
  return new Promise((resolve, reject) => {
    gifInstance.on('finished', (blob: Blob) => {
      if (blob.size === 0) {
        console.error("GIF generation finished but resulted in an empty blob.");
        reject(new Error('GIF generation resulted in an empty file. Check console for errors.'));
        return;
      }
      console.log(`GIF generated successfully. Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      resolve(blob);
    });

    // @ts-ignore - gif.js typings might be incomplete for 'error' event
     gifInstance.on('error', (err: any) => {
       console.error("gif.js encountered an error during rendering:", err);
       reject(new Error(`GIF rendering failed: ${err?.message || err}`));
     });

    // Optional: Progress tracking
    gifInstance.on('progress', (p: number) => {
       console.log(`GIF rendering progress: ${Math.round(p * 100)}%`);
      // You could update UI state here if needed
    });

    // Start the rendering process
    gifInstance.render();
  });
}
