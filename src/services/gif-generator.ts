'use client';

// This file uses pdfjs-dist for PDF rendering and gif.js for GIF encoding.
// Both libraries rely heavily on browser APIs, so this code must run client-side.

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, PDFRenderParams } from 'pdfjs-dist/types/display/api';
import type { PDFWorkerParameters } from 'pdfjs-dist/types/display/worker_options';

// --- Globals ---
let GIF: any = null; // Placeholder for the GIF library constructor
let pdfjsWorkerSrcConfigured = false;
let gifjsLoaded = false;

// --- Initialization ---
function ensureLibrariesLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('PDF/GIF generation can only run in the browser.'));
    }

    let pdfWorkerPromiseResolved = false;
    let gifLibraryPromiseResolved = false;

    function checkCompletion() {
        if (pdfWorkerPromiseResolved && gifLibraryPromiseResolved) {
            console.log("PDF.js and gif.js libraries ready.");
            resolve();
        } else {
            // console.log(`Library status: PDF worker ready: ${pdfWorkerPromiseResolved}, gif.js ready: ${gifLibraryPromiseResolved}`);
        }
    }

    // Configure PDF.js Worker (only once)
    if (!pdfjsWorkerSrcConfigured) {
      try {
        // Always point to the local pdf.worker.js.
        // The user is responsible for ensuring this file is not a placeholder.
        const workerScriptPath = '/pdf.worker.js';
        (pdfjsLib.GlobalWorkerOptions as PDFWorkerParameters).workerSrc = workerScriptPath;
        pdfjsWorkerSrcConfigured = true;
        pdfWorkerPromiseResolved = true; // Assume configured, PDF.js will handle if worker is bad
        console.log(`PDF.js worker source configured to use local: ${workerScriptPath}. IMPORTANT: Ensure this file is the actual pdf.worker.js and not a placeholder.`);
      } catch (e) {
        console.error("Error setting pdfjs workerSrc to local path:", e);
        pdfWorkerPromiseResolved = false;
        return reject(new Error(`Failed to configure PDF.js worker path: ${e instanceof Error ? e.message : String(e)}`));
      }
      checkCompletion();
    } else {
        pdfWorkerPromiseResolved = true; // Already configured
        checkCompletion();
    }

    // Load gif.js (only once)
    if (!gifjsLoaded && !GIF) {
        console.log("Attempting to load gif.js...");
        import('gif.js/dist/gif.js') // Assumes gif.js is installed and provides a /dist/gif.js
            .then(module => {
                if (module && module.default) {
                    GIF = module.default;
                } else {
                    // Fallback if default export isn't found, try using the module directly
                    // This might be necessary depending on how gif.js structures its UMD/ESM module
                    GIF = module; 
                }

                if (!GIF) {
                    console.error("gif.js module loaded but GIF constructor is still undefined. Module structure might be unexpected.");
                    return reject(new Error("gif.js module loaded but is empty or invalid."));
                }
                gifjsLoaded = true;
                gifLibraryPromiseResolved = true;
                console.log('gif.js loaded successfully.');
                checkCompletion();
            }).catch(err => {
                console.error("Failed to dynamically import gif.js:", err);
                return reject(new Error("Failed to load GIF library (gif.js). Ensure it's correctly installed or accessible."));
            });
    } else if (gifjsLoaded || GIF) { // Check GIF as well in case import was synchronous in some env
         gifLibraryPromiseResolved = true; // Already loaded
         if (!GIF) console.warn("gifjsLoaded is true, but GIF constructor is null. This might indicate an issue.")
         // console.log("gif.js already available.");
         checkCompletion();
    }
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

const PDF_LOAD_TIMEOUT = 30000; // 30 seconds

/**
 * Asynchronously generates a GIF from a PDF file on the client-side.
 *
 * @param pdfFile The PDF file to convert.
 * @param config The configuration options for GIF generation.
 * @param onProgress Optional callback function to report progress (0 to 1).
 * @returns A promise that resolves to a Blob containing the generated GIF file.
 */
export async function generateGifFromPdf(
  pdfFile: File,
  config: GifConfig,
  onProgress?: (progress: number) => void
): Promise<Blob> {

  console.log("generateGifFromPdf called");
  await ensureLibrariesLoaded(); 

  if (!GIF) {
     console.error("GIF library constructor is null after ensureLibrariesLoaded.");
     throw new Error("GIF library failed to initialize correctly.");
  }
   if (!pdfjsLib || !pdfjsLib.getDocument) {
     throw new Error("pdf.js library has not been loaded correctly.");
   }

  console.log("Libraries confirmed loaded. Reading PDF file...");
  const pdfBytes = await pdfFile.arrayBuffer();
  let pdfDoc: PDFDocumentProxy | null = null;

  console.log("Loading PDF document...");
  onProgress?.(0.05); // Indicate progress for starting PDF load

  try {
    const loadPdfPromise = pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`PDF loading timed out after ${PDF_LOAD_TIMEOUT / 1000} seconds. This might be due to a very large/complex PDF, or an issue with the PDF processing worker.`)), PDF_LOAD_TIMEOUT)
    );
    
    pdfDoc = await Promise.race([loadPdfPromise, timeoutPromise]);
    
    if (!pdfDoc || !pdfDoc.numPages) {
      // Handle cases where pdfDoc might be null or numPages is 0/undefined after promise resolution.
      throw new Error("PDF document loaded but is invalid or has no pages.");
    }
    console.log(`PDF document loaded: ${pdfDoc.numPages} pages.`);
    onProgress?.(0.1); // Indicate progress after PDF load
  } catch (error) {
    console.error("Error loading PDF document:", error);
    let friendlyMessage = 'Failed to load PDF document.';
    if (error instanceof Error) {
      if (error.message.includes("timed out")) {
        friendlyMessage = error.message;
      } else if (error.name === 'InvalidPDFException' || error.message.includes('Invalid PDF')) {
        friendlyMessage = 'Invalid PDF file provided.';
      } else if (error.message.includes('PasswordException')) {
        friendlyMessage = 'PDF file is password protected.';
      } else if (error.message.includes('workerSrc') || error.message.includes('Worker was not found') || error.message.includes('worker')) {
        friendlyMessage = 'PDF worker script failed to load, is misconfigured, or is a placeholder. Ensure public/pdf.worker.js is the correct file.';
      } else if (error.message.includes("Unexpected server response (0) while retrieving PDF")) {
         friendlyMessage = 'Could not retrieve PDF data (Network error or invalid source).';
      } else {
        friendlyMessage = `Failed to load PDF: ${error.message}`;
      }
    } else {
      friendlyMessage = `Failed to load PDF: ${String(error)}`;
    }

    if (pdfDoc && typeof pdfDoc.destroy === 'function') {
        try {
            await pdfDoc.destroy();
        } catch (destroyError) {
            console.warn("Error during pdfDoc.destroy() after a loading error:", destroyError);
        }
    }
    throw new Error(friendlyMessage);
  }

  const numPages = pdfDoc.numPages;
  if (numPages === 0) {
    if (pdfDoc && typeof pdfDoc.destroy === 'function') await pdfDoc.destroy();
    throw new Error("PDF file contains no pages.");
  }

  let targetWidth: number | undefined = undefined;
  let gifWidth: number | undefined = undefined;
  let gifHeight: number | undefined = undefined;

  if (config.resolution !== 'original' && config.resolution.includes('xauto')) {
    targetWidth = parseInt(config.resolution.split('xauto')[0], 10);
    if (isNaN(targetWidth) || targetWidth <= 0) {
      console.warn(`Invalid target width in resolution: ${config.resolution}. Falling back to original page width.`);
      targetWidth = undefined;
    } else {
        console.log(`Target width set to ${targetWidth}px.`);
    }
  } else if (config.resolution === 'original') {
      console.log("Using original PDF page size.");
  } else {
     console.warn(`Malformed resolution: ${config.resolution}. Falling back to 500px width as a default if original also fails.`);
     targetWidth = 500; // Default fallback if 'original' is also not explicitly handled or preferred.
  }

  console.log("Initializing GIF encoder...");
  const gifInstance = new GIF({
    // Consider making workers configurable or more robustly determined.
    // Using Math.max(1, ...) ensures at least one worker.
    workers: Math.max(1, navigator.hardwareConcurrency ? Math.floor(navigator.hardwareConcurrency / 2) : 2), 
    quality: 10, // Lower quality (e.g., 20-30) might be faster and smaller, higher (e.g., 1-10) better quality.
    workerScript: '/gif.worker.js', // gif.js worker is still loaded locally from public
    repeat: config.looping ? 0 : -1, // 0 for infinite loop, -1 for no loop.
    background: '#FFFFFF', // Default background color for transparency.
    // width and height will be set after first page is processed if not 'original'
  });
  console.log("GIF encoder initialized.");

  const frameDelay = Math.max(20, Math.round(1000 / config.frameRate)); // Ensure delay is reasonable (gif.js might have min value)
  console.log(`Frame rate: ${config.frameRate} FPS, Delay: ${frameDelay}ms`);

  try {
    for (let i = 1; i <= numPages; i++) {
      const pageProgressStart = 0.1 + (0.8 * (i - 1) / numPages);
      const pageProgressEnd = 0.1 + (0.8 * i / numPages);
      onProgress?.(pageProgressStart);

      console.log(`Processing page ${i} of ${numPages}...`);
      const page: PDFPageProxy = await pdfDoc.getPage(i);
      const originalViewport = page.getViewport({ scale: 1.0 });
      console.log(`Page ${i} original dimensions: ${originalViewport.width}x${originalViewport.height}`);

      let scale = 1.0;
      let renderWidth = originalViewport.width;
      let renderHeight = originalViewport.height;

      if (targetWidth) { // If a specific width is targeted
        scale = targetWidth / originalViewport.width;
        renderWidth = targetWidth;
        renderHeight = originalViewport.height * scale;
      }
      // Ensure dimensions are integers and at least 1px
      renderWidth = Math.max(1, Math.floor(renderWidth));
      renderHeight = Math.max(1, Math.floor(renderHeight));

      if (i === 1) { // Set GIF dimensions based on the first page's (potentially scaled) size
        gifWidth = renderWidth;
        gifHeight = renderHeight;
        console.log(`Setting GIF dimensions to: ${gifWidth}x${gifHeight}`);
        // @ts-ignore - gif.js typings might not expose options directly
        gifInstance.options.width = gifWidth;
        // @ts-ignore
        gifInstance.options.height = gifHeight;
      }

      const viewport = page.getViewport({ scale: scale });
      console.log(`Page ${i} rendering at scale ${scale.toFixed(2)}, viewport: ${viewport.width.toFixed(0)}x${viewport.height.toFixed(0)}`);

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error(`Could not get 2D rendering context for page ${i}.`);
      }
      canvas.width = Math.max(1, Math.floor(viewport.width)); // Use viewport width for canvas
      canvas.height = Math.max(1, Math.floor(viewport.height)); // Use viewport height for canvas


      const renderContext: PDFRenderParams = {
        canvasContext: context,
        viewport: viewport,
      };

      console.log(`Rendering page ${i} to canvas (${canvas.width}x${canvas.height})...`);
      await page.render(renderContext).promise;
      onProgress?.(pageProgressStart + (pageProgressEnd - pageProgressStart) * 0.7); 
      console.log(`Page ${i} rendered.`);

      let frameToAdd: CanvasImageSource = canvas;

      // If canvas size doesn't match GIF dimensions (e.g. subsequent pages are different, or first page scaling was off)
      // Create a new canvas of the target GIF size and draw the current page's canvas onto it.
      if (gifWidth && gifHeight && (canvas.width !== gifWidth || canvas.height !== gifHeight)) {
        console.warn(`Frame ${i} canvas size (${canvas.width}x${canvas.height}) differs from target GIF size (${gifWidth}x${gifHeight}). Fitting frame.`);
        const sizedCanvas = document.createElement('canvas');
        sizedCanvas.width = gifWidth;
        sizedCanvas.height = gifHeight;
        const sizedContext = sizedCanvas.getContext('2d');
        if (!sizedContext) {
           console.error(`Could not get 2D context for resized canvas on frame ${i}. Using original frame.`);
        } else {
          sizedContext.fillStyle = '#FFFFFF'; // Fill with background color
          sizedContext.fillRect(0, 0, gifWidth, gifHeight);

          // Calculate aspect ratio to fit the source canvas into the target GIF dimensions
          const drawRatio = Math.min(gifWidth / canvas.width, gifHeight / canvas.height);
          const drawnWidth = canvas.width * drawRatio;
          const drawnHeight = canvas.height * drawRatio;
          // Center the drawn image
          const offsetX = (gifWidth - drawnWidth) / 2;
          const offsetY = (gifHeight - drawnHeight) / 2;

          sizedContext.drawImage(canvas, offsetX, offsetY, drawnWidth, drawnHeight);
          frameToAdd = sizedCanvas; // Use this consistently sized canvas for the GIF frame
        }
      }

      console.log(`Adding frame ${i} to GIF instance...`);
      // @ts-ignore - gif.js addFrame might not have perfect typings for options
      gifInstance.addFrame(frameToAdd, { delay: frameDelay, copy: true }); // copy: true is important if canvas is reused/modified
      console.log(`Frame ${i} added.`);
      onProgress?.(pageProgressEnd); 

      page.cleanup(); // Important to free up resources
    }
  } catch (renderError) {
       console.error("Error during page rendering loop:", renderError);
        if (pdfDoc) {
            // Ensure cleanup happens even if loop fails
            await pdfDoc.destroy().catch(e => console.error("Error destroying PDF doc after render error:", e));
        }
       throw new Error(`Failed during PDF page processing: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
  }

  console.log("Cleaning up PDF document resources...");
  if (pdfDoc && typeof pdfDoc.destroy === 'function') await pdfDoc.destroy();
  console.log("PDF document cleanup complete.");
  onProgress?.(0.95); 

  console.log("Starting final GIF rendering...");
  return new Promise((resolve, reject) => {
    gifInstance.on('finished', (blob: Blob) => {
        console.log("GIF encoder finished.");
      if (!blob || blob.size === 0) {
        console.error("GIF generation finished but resulted in an empty or invalid blob.", blob);
        reject(new Error('GIF generation failed: Output is empty. This could be due to issues with gif.js worker or encoding. Check browser console for detailed errors.'));
        return;
      }
      console.log(`GIF generated successfully. Type: ${blob.type}, Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      onProgress?.(1.0); 
      resolve(blob);
    });

    // @ts-ignore - gif.js error event might not be typed
     gifInstance.on('error', (err: any) => {
       console.error("gif.js encountered an error during final rendering:", err);
       reject(new Error(`GIF final rendering failed: ${err?.message || String(err)}`));
     });

    gifInstance.on('progress', (p: number) => {
       // This progress is for the final GIF rendering stage by gif.js
       const finalProgress = 0.95 + p * 0.05; // Scale gif.js progress (0-1) to the remaining 5%
       console.log(`GIF final rendering progress: ${Math.round(p * 100)}%`);
       onProgress?.(finalProgress);
    });

    gifInstance.render();
     console.log("gifInstance.render() called.");
  });
}

    