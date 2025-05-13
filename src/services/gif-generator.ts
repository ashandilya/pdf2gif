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
            console.log(`Library status: PDF worker ready: ${pdfWorkerPromiseResolved}, gif.js ready: ${gifLibraryPromiseResolved}`);
        }
    }

    // Configure PDF.js Worker (only once)
    if (!pdfjsWorkerSrcConfigured) {
      fetch('/pdf.worker.js')
        .then(response => {
          if (!response.ok) {
            const message = `pdf.worker.js not found or inaccessible (status: ${response.status}) at /public/pdf.worker.js. PDF processing will fail. Please ensure the correct worker file from 'node_modules/pdfjs-dist/build/pdf.worker.js' is placed in the public directory.`;
            console.error(message);
            return reject(new Error(message)); 
          }
          return response.text(); 
        })
        .then(workerScriptText => {
          if (workerScriptText.includes("PLEASE COPY THE ACTUAL WORKER FILE HERE") || workerScriptText.includes("This file is a placeholder")) {
            const message = "Placeholder pdf.worker.js detected. PDF processing will fail. Please replace it with the actual file from 'node_modules/pdfjs-dist/build/pdf.worker.js'.";
            console.error(message);
            return reject(new Error(message));
          }
          
          try {
            (pdfjsLib.GlobalWorkerOptions as PDFWorkerParameters).workerSrc = `/pdf.worker.js`;
            pdfjsWorkerSrcConfigured = true;
            pdfWorkerPromiseResolved = true;
            console.log("PDF.js worker source configured with /pdf.worker.js.");
          } catch (e) {
            console.error("Error setting pdfjs workerSrc:", e);
            return reject(new Error("Failed to configure PDF.js worker."));
          }
          checkCompletion();
        })
        .catch(err => {
          console.error("Error during pdf.worker.js verification or setup:", err);
          const detailedMessage = err instanceof Error ? err.message : String(err);
          return reject(new Error(`Failed to initialize PDF worker: ${detailedMessage}. Please ensure /public/pdf.worker.js is correct and accessible.`));
        });
    } else {
        pdfWorkerPromiseResolved = true; // Already configured
        checkCompletion();
    }

    // Load gif.js (only once)
    if (!gifjsLoaded && !GIF) {
        console.log("Attempting to load gif.js...");
        import('gif.js/dist/gif.js') 
            .then(module => {
                if (module && module.default) {
                    GIF = module.default;
                } else {
                    // Fallback if default export isn't found, try using the module directly
                    GIF = module; 
                }

                if (!GIF) {
                    console.error("gif.js module loaded but GIF constructor is still undefined.");
                    return reject(new Error("gif.js module loaded but is empty or invalid."));
                }
                gifjsLoaded = true;
                gifLibraryPromiseResolved = true;
                console.log('gif.js loaded successfully.');
                checkCompletion();
            }).catch(err => {
                console.error("Failed to dynamically import gif.js:", err);
                return reject(new Error("Failed to load GIF library (gif.js)."));
            });
    } else if (gifjsLoaded) {
         gifLibraryPromiseResolved = true; // Already loaded
         console.log("gif.js already loaded.");
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
      setTimeout(() => reject(new Error(`PDF loading timed out after ${PDF_LOAD_TIMEOUT / 1000} seconds. This might be due to a very large/complex PDF, or an issue with the PDF processing worker (pdf.worker.js).`)), PDF_LOAD_TIMEOUT)
    );
    
    pdfDoc = await Promise.race([loadPdfPromise, timeoutPromise]);
    
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
        friendlyMessage = 'PDF worker script failed to load or is misconfigured. Ensure /public/pdf.worker.js is the correct file from node_modules/pdfjs-dist/build/pdf.worker.js and is accessible.';
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
      console.warn(`Invalid target width in resolution: ${config.resolution}. Falling back to original.`);
      targetWidth = undefined;
    } else {
        console.log(`Target width set to ${targetWidth}px.`);
    }
  } else if (config.resolution === 'original') {
      console.log("Using original PDF page size.");
  } else {
     console.warn(`Malformed resolution: ${config.resolution}. Falling back to 500px width.`);
     targetWidth = 500;
  }

  console.log("Initializing GIF encoder...");
  const gifInstance = new GIF({
    workers: Math.max(1, navigator.hardwareConcurrency ? Math.floor(navigator.hardwareConcurrency / 2) : 2), 
    quality: 10, 
    workerScript: '/gif.worker.js', 
    repeat: config.looping ? 0 : -1, 
    background: '#FFFFFF',
  });
  console.log("GIF encoder initialized.");

  const frameDelay = Math.max(20, Math.round(1000 / config.frameRate)); 
  console.log(`Frame rate: ${config.frameRate} FPS, Delay: ${frameDelay}ms`);

  try {
    for (let i = 1; i <= numPages; i++) {
      const pageProgressStart = 0.1 + (0.8 * (i - 1) / numPages);
      const pageProgressEnd = 0.1 + (0.8 * i / numPages);
      onProgress?.(pageProgressStart);

      console.log(`Processing page ${i} of ${numPages}...`);
      const page = await pdfDoc.getPage(i);
      const originalViewport = page.getViewport({ scale: 1.0 });
      console.log(`Page ${i} original dimensions: ${originalViewport.width}x${originalViewport.height}`);

      let scale = 1.0;
      let renderWidth = originalViewport.width;
      let renderHeight = originalViewport.height;

      if (targetWidth) {
        scale = targetWidth / originalViewport.width;
        renderWidth = targetWidth;
        renderHeight = originalViewport.height * scale;
      }

      renderWidth = Math.max(1, Math.floor(renderWidth));
      renderHeight = Math.max(1, Math.floor(renderHeight));

      if (i === 1) {
        gifWidth = renderWidth;
        gifHeight = renderHeight;
        console.log(`Setting GIF dimensions to: ${gifWidth}x${gifHeight}`);
        // @ts-ignore 
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
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const renderContext: PDFRenderParams = {
        canvasContext: context,
        viewport: viewport,
      };

      console.log(`Rendering page ${i} to canvas...`);
      await page.render(renderContext).promise;
      onProgress?.(pageProgressStart + (pageProgressEnd - pageProgressStart) * 0.7); 
      console.log(`Page ${i} rendered.`);

      let frameToAdd: CanvasImageSource = canvas;

      if (gifWidth && gifHeight && (canvas.width !== gifWidth || canvas.height !== gifHeight)) {
        console.warn(`Frame ${i} size (${canvas.width}x${canvas.height}) differs from GIF size (${gifWidth}x${gifHeight}). Resizing/Fitting.`);
        const sizedCanvas = document.createElement('canvas');
        sizedCanvas.width = gifWidth;
        sizedCanvas.height = gifHeight;
        const sizedContext = sizedCanvas.getContext('2d');
        if (!sizedContext) {
           console.error(`Could not get 2D context for resized canvas on frame ${i}. Skipping resize.`);
        } else {
          sizedContext.fillStyle = '#FFFFFF'; 
          sizedContext.fillRect(0, 0, gifWidth, gifHeight);

          const drawRatio = Math.min(gifWidth / canvas.width, gifHeight / canvas.height);
          const drawnWidth = canvas.width * drawRatio;
          const drawnHeight = canvas.height * drawRatio;
          const offsetX = (gifWidth - drawnWidth) / 2;
          const offsetY = (gifHeight - drawnHeight) / 2;

          sizedContext.drawImage(canvas, offsetX, offsetY, drawnWidth, drawnHeight);
          frameToAdd = sizedCanvas; 
        }
      }

      console.log(`Adding frame ${i} to GIF instance...`);
      gifInstance.addFrame(frameToAdd, { delay: frameDelay, copy: true }); 
      console.log(`Frame ${i} added.`);
      onProgress?.(pageProgressEnd); 

      page.cleanup();
    }
  } catch (renderError) {
       console.error("Error during page rendering loop:", renderError);
        if (pdfDoc) {
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
        reject(new Error('GIF generation failed: Output is empty. Check browser console for detailed errors.'));
        return;
      }
      console.log(`GIF generated successfully. Type: ${blob.type}, Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      onProgress?.(1.0); 
      resolve(blob);
    });

    // @ts-ignore 
     gifInstance.on('error', (err: any) => {
       console.error("gif.js encountered an error during final rendering:", err);
       reject(new Error(`GIF final rendering failed: ${err?.message || String(err)}`));
     });

    gifInstance.on('progress', (p: number) => {
       const finalProgress = 0.95 + p * 0.05; 
       console.log(`GIF final rendering progress: ${Math.round(p * 100)}%`);
       onProgress?.(finalProgress);
    });

    gifInstance.render();
     console.log("gifInstance.render() called.");
  });
}
