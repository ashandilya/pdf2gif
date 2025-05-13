'use client';

// This file is intended for client-side operations.
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js'; 
import GIF from 'gif.js/dist/gif'; // Adjusted import for gif.js

// Configure the PDF.js worker.
// IMPORTANT: You MUST copy 'pdf.worker.js' from 'node_modules/pdfjs-dist/build/pdf.worker.js'
// to your 'public' directory and ensure this path is correct.
if (typeof window !== 'undefined') {
  // Ensure the workerSrc is set. If pdf.worker.js is a placeholder, PDF rendering will likely fail or be very slow.
  // The path should match the location in your `public` folder.
  // Check if pdf.worker.js is available, if not, pdfjs will try to load it from CDN or fail.
  const workerUrl = '/pdf.worker.js'; 
  // Test if workerUrl is accessible, not strictly necessary but good for debugging
  // fetch(workerUrl).then(res => { if(!res.ok) console.warn(`pdf.worker.js not found at ${workerUrl}`)})
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

/**
 * Represents the configuration options for GIF generation.
 */
export interface GifConfig {
  /**
   * The frame rate of the GIF (frames per second).
   */
  frameRate: number;
  /**
   * The resolution of the GIF.
   * Can be 'original' or 'WIDTHxauto' (e.g., '500xauto').
   * If 'WIDTHxauto', specifies the target width, height is auto-scaled.
   */
  resolution: string;
  /**
   * Whether the GIF should loop.
   */
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
  
  // Ensure GIF library is available (it should be, due to the import)
  if (!GIF) {
    throw new Error("GIF library (gif.js) failed to load or is not available.");
  }

  const pdfBytes = await pdfFile.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const numPages = pdfDoc.numPages;

  let targetWidth: number | undefined = undefined;
  let gifWidth: number | undefined = undefined;
  let gifHeight: number | undefined = undefined;

  if (config.resolution !== 'original' && config.resolution.includes('xauto')) {
    targetWidth = parseInt(config.resolution.split('xauto')[0], 10);
    if (isNaN(targetWidth) || targetWidth <=0) {
        console.warn(`Invalid target width in resolution: ${config.resolution}. Falling back to original.`);
        targetWidth = undefined;
    }
  }

  // Initialize gif.js
  // Note: gif.js expects width and height to be set if known, otherwise it might take from the first frame.
  // We'll set them after processing the first page.
  const gifInstance = new GIF({
    workers: 2, 
    quality: 10, 
    workerScript: '/gif.worker.js', // Path to gif.worker.js in the public folder
    repeat: config.looping ? 0 : -1, 
    // width and height will be set dynamically from the first frame
  });

  const frameDelay = Math.max(20, Math.round(1000 / config.frameRate)); // Delay in milliseconds, ensure minimum delay

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const originalViewport = page.getViewport({ scale: 1.0 });

    let scale = 1.0;
    let currentFrameRenderWidth = originalViewport.width;
    let currentFrameRenderHeight = originalViewport.height;

    if (targetWidth) {
      scale = targetWidth / originalViewport.width;
      currentFrameRenderWidth = targetWidth;
      currentFrameRenderHeight = Math.floor(originalViewport.height * scale);
    } else if (config.resolution === 'original') {
        // Use original dimensions, ensuring they are integers
        currentFrameRenderWidth = Math.floor(originalViewport.width);
        currentFrameRenderHeight = Math.floor(originalViewport.height);
    } else { // Default or fallback if resolution string is malformed
        // Default to a reasonable width if targetWidth was invalid
        const defaultWidth = 500;
        scale = defaultWidth / originalViewport.width;
        currentFrameRenderWidth = defaultWidth;
        currentFrameRenderHeight = Math.floor(originalViewport.height * scale);
    }
    
    // Ensure dimensions are positive
    currentFrameRenderWidth = Math.max(1, currentFrameRenderWidth);
    currentFrameRenderHeight = Math.max(1, currentFrameRenderHeight);

    if (i === 1) {
        gifWidth = currentFrameRenderWidth;
        gifHeight = currentFrameRenderHeight;
        // @ts-ignore Property 'width' does not exist on type 'GIF'. gif.js is not well-typed.
        gifInstance.options.width = gifWidth;
        // @ts-ignore
        gifInstance.options.height = gifHeight;
    }

    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width); // Use viewport dimensions from scale
    canvas.height = Math.floor(viewport.height);
    // Ensure canvas dimensions are positive
    if (canvas.width <= 0) canvas.width = 1;
    if (canvas.height <= 0) canvas.height = 1;


    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D rendering context from canvas for PDF page.');
    }

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;

    // The canvas now contains the rendered page at its scaled size.
    // gif.js can usually handle frames of slightly different sizes, but it's best if they are consistent.
    // If the first frame set gifWidth/gifHeight, and subsequent frames differ, we might need to resize/re-draw.
    let frameToAdd: CanvasRenderingContext2D | HTMLImageElement | ImageData = context.canvas;

    if (gifWidth && gifHeight && (canvas.width !== gifWidth || canvas.height !== gifHeight)) {
        // Create a new canvas with the target GIF dimensions and draw the current page onto it.
        const sizedCanvas = document.createElement('canvas');
        sizedCanvas.width = gifWidth;
        sizedCanvas.height = gifHeight;
        const sizedContext = sizedCanvas.getContext('2d');
        if (!sizedContext) {
            throw new Error('Could not get 2D context for sized canvas for frame adjustment.');
        }
        // Fill background (optional, if pages are transparent or smaller)
        // sizedContext.fillStyle = '#FFFFFF'; // Example: white background
        // sizedContext.fillRect(0, 0, gifWidth, gifHeight);

        // Draw the rendered page image onto the correctly sized canvas
        // This example will center and scale to fit (letterbox/pillarbox).
        const drawRatio = Math.min(gifWidth / canvas.width, gifHeight / canvas.height);
        const drawnWidth = canvas.width * drawRatio;
        const drawnHeight = canvas.height * drawRatio;
        const offsetX = (gifWidth - drawnWidth) / 2;
        const offsetY = (gifHeight - drawnHeight) / 2;
        
        sizedContext.drawImage(canvas, offsetX, offsetY, drawnWidth, drawnHeight);
        frameToAdd = sizedContext.canvas;
    }
    
    // Add the canvas (or its context) to the GIF
    // `copy: true` is important if you're reusing the canvas/context object
    gifInstance.addFrame(frameToAdd, { delay: frameDelay, copy: true }); 
  }

  return new Promise((resolve, reject) => {
    gifInstance.on('finished', (blob: Blob) => {
      if (blob.size === 0) {
        reject(new Error('GIF generation resulted in an empty blob. Check console for errors.'));
        return;
      }
      resolve(blob);
    });
    // @ts-ignore gif.js 'error' event may not be formally typed
    gifInstance.on('error', (err: any) => {
      reject(new Error(`GIF generation failed: ${err?.message || err}`));
    });
    gifInstance.on('progress', (p: number) => {
      // console.log(`GIF rendering progress: ${Math.round(p * 100)}%`);
      // Potentially update UI with progress here
    });
    gifInstance.render();
  });
}
