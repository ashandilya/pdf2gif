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

    // Configure PDF.js Worker (only once)
    if (!pdfjsWorkerSrcConfigured) {
      try {
        // IMPORTANT: Ensure 'public/pdf.worker.js' exists and is the correct worker file.
        // Check if file exists (simple check, might need more robust method in production)
        fetch('/pdf.worker.js').then(response => {
          if (!response.ok) {
            console.warn("pdf.worker.js not found or accessible at /public/pdf.worker.js. PDF processing might fail.");
            // Optionally throw error or let pdfjs handle it internally
          }
          (pdfjsLib.GlobalWorkerOptions as PDFWorkerParameters).workerSrc = `/pdf.worker.js`;
          pdfjsWorkerSrcConfigured = true;
          console.log("PDF.js worker source configured.");
          checkCompletion();
        }).catch(err => {
          console.error("Failed to fetch pdf.worker.js:", err);
          // Fallback or error handling - Try setting anyway?
           try {
             (pdfjsLib.GlobalWorkerOptions as PDFWorkerParameters).workerSrc = `/pdf.worker.js`;
             pdfjsWorkerSrcConfigured = true;
             console.warn("Set PDF.js worker source despite fetch error.");
             checkCompletion();
           } catch (e) {
               console.error("FATAL: Error setting pdfjs workerSrc:", e)
               return reject(new Error("Failed to configure PDF.js worker."));
           }
        });
      } catch (e) {
        console.error("Error setting pdfjs workerSrc:", e);
        return reject(new Error("Failed to configure PDF.js worker."));
      }
    }

    // Load gif.js (only once)
    if (!gifjsLoaded && !GIF) {
        console.log("Attempting to load gif.js...");
        import('gif.js/dist/gif.js') // Ensure correct path to gif.js main file
            .then(module => {
                if (module && module.default) {
                    GIF = module.default;
                    gifjsLoaded = true;
                    console.log('gif.js loaded successfully.');
                } else {
                    console.error("Failed to load gif.js: Default export not found.", module);
                    GIF = module; // Attempt to use the module directly
                    if (!GIF) {
                        return reject(new Error("gif.js module loaded but is empty or invalid."));
                    }
                    gifjsLoaded = true; // Mark as loaded even if default wasn't found
                     console.log('gif.js loaded (without default export).');
                }
                 checkCompletion();
            }).catch(err => {
                console.error("Failed to dynamically import gif.js:", err);
                return reject(new Error("Failed to load GIF library (gif.js)."));
            });
    } else if (gifjsLoaded) {
         console.log("gif.js already loaded.");
         checkCompletion(); // Check if PDF worker is also ready
    }


    function checkCompletion() {
        // Resolve once both are ready (or seem ready)
        if (pdfjsWorkerSrcConfigured && gifjsLoaded) {
            console.log("PDF.js and gif.js libraries ready.");
            resolve();
        } else {
             console.log(`Library status: PDF worker configured: ${pdfjsWorkerSrcConfigured}, gif.js loaded: ${gifjsLoaded}`);
        }
    }
     // Initial check if libraries might already be loaded
     checkCompletion();
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
 * @param onProgress Optional callback function to report progress (0 to 1).
 * @returns A promise that resolves to a Blob containing the generated GIF file.
 */
export async function generateGifFromPdf(
  pdfFile: File,
  config: GifConfig,
  onProgress?: (progress: number) => void
): Promise<Blob> {

  console.log("generateGifFromPdf called");
  await ensureLibrariesLoaded(); // Ensure libraries are ready before proceeding

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

  try {
     console.log("Loading PDF document...");
    onProgress?.(0.05); // Indicate progress
    pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    console.log(`PDF document loaded: ${pdfDoc.numPages} pages.`);
    onProgress?.(0.1); // Indicate progress
  } catch (error) {
    console.error("Error loading PDF document:", error);
     let friendlyMessage = 'Failed to load PDF document.';
     if (error instanceof Error) {
        if (error.name === 'InvalidPDFException' || error.message.includes('Invalid PDF')) {
           friendlyMessage = 'Invalid PDF file provided.';
        } else if (error.message.includes('PasswordException')) {
            friendlyMessage = 'PDF file is password protected.';
        } else if (error.message.includes('workerSrc')) {
           friendlyMessage = 'PDF worker script failed to load. Check network access to /pdf.worker.js.';
        } else if (error.message.includes("Unexpected server response (0) while retrieving PDF")) {
           friendlyMessage = 'Could not retrieve PDF data (Network error or invalid source).'
        }
     }
    throw new Error(friendlyMessage);
  }

  const numPages = pdfDoc.numPages;
  if (numPages === 0) {
    await pdfDoc.destroy();
    throw new Error("PDF file contains no pages.");
  }

  let targetWidth: number | undefined = undefined;
  let gifWidth: number | undefined = undefined;
  let gifHeight: number | undefined = undefined;

  // Parse resolution config
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
     targetWidth = 500; // Fallback
  }

  // Initialize gif.js
   console.log("Initializing GIF encoder...");
  const gifInstance = new GIF({
    workers: Math.max(1, navigator.hardwareConcurrency ? Math.floor(navigator.hardwareConcurrency / 2) : 2), // Use half available cores, min 1, default 2
    quality: 10, // Pixel sample interval (1-30), lower is better quality but slower. 10 is default.
    workerScript: '/gif.worker.js', // Path to the gif.js worker script in public folder
    repeat: config.looping ? 0 : -1, // 0 for loop indefinitely, -1 for no loop
    background: '#FFFFFF', // Default background color (optional)
    // width & height will be set based on the first frame
  });
  console.log("GIF encoder initialized.");

  const frameDelay = Math.max(20, Math.round(1000 / config.frameRate)); // Delay in ms, min 20ms (GIF standard)
  console.log(`Frame rate: ${config.frameRate} FPS, Delay: ${frameDelay}ms`);

  // --- Page Rendering Loop ---
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

      // Determine render scale and dimensions
      if (targetWidth) {
        scale = targetWidth / originalViewport.width;
        renderWidth = targetWidth;
        renderHeight = originalViewport.height * scale;
      } else { // Original size
        scale = 1.0;
      }

      // Ensure dimensions are positive integers
      renderWidth = Math.max(1, Math.floor(renderWidth));
      renderHeight = Math.max(1, Math.floor(renderHeight));

      // Set GIF dimensions based on the first frame
      if (i === 1) {
        gifWidth = renderWidth;
        gifHeight = renderHeight;
        console.log(`Setting GIF dimensions to: ${gifWidth}x${gifHeight}`);
        // @ts-ignore - gif.js typings might be incomplete
        gifInstance.options.width = gifWidth;
        // @ts-ignore
        gifInstance.options.height = gifHeight;
      }

      // Create viewport with calculated scale for rendering
      const viewport = page.getViewport({ scale: scale });
       console.log(`Page ${i} rendering at scale ${scale.toFixed(2)}, viewport: ${viewport.width.toFixed(0)}x${viewport.height.toFixed(0)}`);

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error(`Could not get 2D rendering context for page ${i}.`);
      }
      // Use viewport dimensions for canvas to avoid potential floating point issues
       canvas.width = Math.max(1, Math.floor(viewport.width));
       canvas.height = Math.max(1, Math.floor(viewport.height));


      const renderContext: PDFRenderParams = {
        canvasContext: context,
        viewport: viewport,
         // Optional: Enhance rendering quality if needed
        // intent: 'print', // Or 'display' (default)
        // renderInteractiveForms: false,
      };

      console.log(`Rendering page ${i} to canvas...`);
      await page.render(renderContext).promise;
       onProgress?.(pageProgressStart + (pageProgressEnd - pageProgressStart) * 0.7); // 70% of page progress is rendering
      console.log(`Page ${i} rendered.`);

      // Add the rendered frame to the GIF
      let frameToAdd: CanvasImageSource = canvas;

      // Resize/fit frame if necessary (if current page size differs from first page size)
      if (gifWidth && gifHeight && (canvas.width !== gifWidth || canvas.height !== gifHeight)) {
        console.warn(`Frame ${i} size (${canvas.width}x${canvas.height}) differs from GIF size (${gifWidth}x${gifHeight}). Resizing/Fitting.`);
        const sizedCanvas = document.createElement('canvas');
        sizedCanvas.width = gifWidth;
        sizedCanvas.height = gifHeight;
        const sizedContext = sizedCanvas.getContext('2d');
        if (!sizedContext) {
           console.error(`Could not get 2D context for resized canvas on frame ${i}. Skipping resize.`);
        } else {
          sizedContext.fillStyle = '#FFFFFF'; // Ensure consistent background
          sizedContext.fillRect(0, 0, gifWidth, gifHeight);

          // Draw the rendered page onto the target-sized canvas (fit aspect ratio, center)
          const drawRatio = Math.min(gifWidth / canvas.width, gifHeight / canvas.height);
          const drawnWidth = canvas.width * drawRatio;
          const drawnHeight = canvas.height * drawRatio;
          const offsetX = (gifWidth - drawnWidth) / 2;
          const offsetY = (gifHeight - drawnHeight) / 2;

          sizedContext.drawImage(canvas, offsetX, offsetY, drawnWidth, drawnHeight);
          frameToAdd = sizedCanvas; // Use the resized canvas
        }
      }

      console.log(`Adding frame ${i} to GIF instance...`);
      gifInstance.addFrame(frameToAdd, { delay: frameDelay, copy: true }); // copy: true is important!
      console.log(`Frame ${i} added.`);
       onProgress?.(pageProgressEnd); // Page complete

       // Cleanup page resources (optional, but good practice)
        page.cleanup();
    }
  } catch (renderError) {
       console.error("Error during page rendering loop:", renderError);
       // Try to destroy PDF doc even if rendering failed
        if (pdfDoc) {
            await pdfDoc.destroy().catch(e => console.error("Error destroying PDF doc after render error:", e));
        }
       throw new Error(`Failed during PDF page processing: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
  }


  // Cleanup PDF document
  console.log("Cleaning up PDF document resources...");
  await pdfDoc.destroy();
  console.log("PDF document cleanup complete.");
  onProgress?.(0.95); // Nearing completion

  // --- GIF Rendering ---
  console.log("Starting final GIF rendering...");
  // Return a promise that resolves with the GIF Blob
  return new Promise((resolve, reject) => {
    gifInstance.on('finished', (blob: Blob) => {
        console.log("GIF encoder finished.");
      if (!blob || blob.size === 0) {
        console.error("GIF generation finished but resulted in an empty or invalid blob.", blob);
        reject(new Error('GIF generation failed: Output is empty. Check browser console for detailed errors.'));
        return;
      }
      console.log(`GIF generated successfully. Type: ${blob.type}, Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      onProgress?.(1.0); // Complete
      resolve(blob);
    });

    // @ts-ignore - gif.js typings might be incomplete for 'error' event
     gifInstance.on('error', (err: any) => {
       console.error("gif.js encountered an error during final rendering:", err);
       reject(new Error(`GIF final rendering failed: ${err?.message || err}`));
     });

    // Optional: Progress tracking during final rendering stage
    gifInstance.on('progress', (p: number) => {
       const finalProgress = 0.95 + p * 0.05; // Map gif.js progress (0-1) to the last 5%
       console.log(`GIF final rendering progress: ${Math.round(p * 100)}%`);
       onProgress?.(finalProgress);
    });

    // Start the rendering process
    gifInstance.render();
     console.log("gifInstance.render() called.");
  });
}
