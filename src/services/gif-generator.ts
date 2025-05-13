'use client';

import * as pdfjsLib from 'pdfjs-dist';
// For pdfjs-dist v3.x, PDFWorkerParameters might be directly on GlobalWorkerOptions or differently namespaced.
// Assuming it's part of the main pdfjsLib import for broader compatibility or might not be strictly needed for basic workerSrc assignment.
// If specific type `PDFWorkerParameters` is needed and path changes, it would be:
// import type { PDFWorkerParameters } from 'pdfjs-dist/types/src/display/worker_options'; // Example path, might vary
// However, direct assignment to GlobalWorkerOptions.workerSrc often works without explicit type.

import GIFEncoder from 'gif-encoder-2';

let pdfjsWorkerSrcConfigured = false;
const PDF_LOAD_TIMEOUT = 30000; // 30 seconds
const MAX_PDF_SIZE_BYTES = 40 * 1024 * 1024; // 40MB

async function ensurePdfJsWorkerConfigured(): Promise<void> {
  if (typeof window === 'undefined') {
    // This function is client-side, but this check is a safeguard.
    return Promise.reject(new Error('PDF processing can only run in the browser.'));
  }

  if (pdfjsWorkerSrcConfigured) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      // The workerSrc path assumes pdf.worker.js is in the public folder.
      // For pdfjs-dist v3.x, the worker file is typically found in `node_modules/pdfjs-dist/build/pdf.worker.js`.
      const workerSrc = '/pdf.worker.js'; 
      console.log(`Configuring PDF.js worker source to: ${workerSrc}`);
      
      // pdfjsLib.GlobalWorkerOptions type might differ slightly in v3.x, but workerSrc assignment is standard.
      (pdfjsLib.GlobalWorkerOptions as any).workerSrc = workerSrc;
      
      // Verify the worker script is not a placeholder.
      fetch(workerSrc)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch pdf.worker.js, status: ${response.status}`);
          }
          return response.text();
        })
        .then(scriptText => {
          if (scriptText.includes("PLEASE COPY THE ACTUAL WORKER FILE HERE") || scriptText.includes("This file is a placeholder")) {
            const message = "Placeholder pdf.worker.js detected. PDF processing will fail. Please replace it with the actual file from 'node_modules/pdfjs-dist/build/pdf.worker.js' (for pdfjs-dist v3.x).";
            console.error(message);
            return reject(new Error(message));
          }
          pdfjsWorkerSrcConfigured = true;
          console.log("PDF.js worker configured and verified.");
          resolve();
        })
        .catch(err => {
          console.error("Error verifying pdf.worker.js:", err);
          reject(new Error(`Failed to load or verify pdf.worker.js: ${err.message}. Ensure it is present in the public folder and is not a placeholder.`));
        });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error("Error setting pdfjs workerSrc:", error);
      reject(new Error(`Failed to configure PDF.js worker: ${error.message}`));
    }
  });
}

export interface GifConfig {
  frameRate: number;
  resolution: string; 
  looping: boolean;
}

export async function generateGifFromPdf(
  pdfFile: File,
  config: GifConfig,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  console.log("generateGifFromPdf called with config:", config);
  
  if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(`PDF file size (${(pdfFile.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum limit of ${MAX_PDF_SIZE_BYTES / 1024 / 1024}MB.`);
  }

  await ensurePdfJsWorkerConfigured();

  if (!pdfjsLib || !pdfjsLib.getDocument) {
    throw new Error("pdf.js library has not been loaded correctly.");
  }

  console.log("Reading PDF file into ArrayBuffer...");
  const pdfBytes = await pdfFile.arrayBuffer();
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

  console.log("Loading PDF document with pdfjs-dist...");
  onProgress?.(0.05);

  try {
    const loadTask = pdfjsLib.getDocument({ data: pdfBytes });
    const loadPdfPromise = loadTask.promise;
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        if (loadTask.destroy) {
          loadTask.destroy().catch(destroyError => console.warn("Error destroying loadTask on timeout:", destroyError));
        }
        reject(new Error(`PDF loading timed out after ${PDF_LOAD_TIMEOUT / 1000} seconds. This might be due to a very large/complex PDF, an issue with the PDF processing worker, or an incompatible PDF version.`));
      }, PDF_LOAD_TIMEOUT)
    );
    
    pdfDoc = await Promise.race([loadPdfPromise, timeoutPromise]);

    if (!pdfDoc || !pdfDoc.numPages) {
      throw new Error("PDF document loaded but is invalid or has no pages.");
    }
    console.log(`PDF document loaded: ${pdfDoc.numPages} pages.`);
    onProgress?.(0.1);
  } catch (error) {
    console.error("Error loading PDF document:", error);
    const friendlyMessage = error instanceof Error ? error.message : String(error);
    if (pdfDoc && typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy().catch(destroyError => console.warn("Error destroying pdfDoc after loading error:", destroyError));
    }
    throw new Error(`Failed to load PDF: ${friendlyMessage}. Ensure the PDF is valid and the worker is correctly configured.`);
  }

  const numPages = pdfDoc.numPages;
  if (numPages === 0) {
    if (pdfDoc && typeof pdfDoc.destroy === 'function') await pdfDoc.destroy();
    throw new Error("PDF file contains no pages.");
  }

  let targetWidth: number | undefined = undefined;
  let gifWidth: number = 0; 
  let gifHeight: number = 0;

  try {
    const firstPageForDimensions = await pdfDoc.getPage(1);
    const firstPageViewport = firstPageForDimensions.getViewport({ scale: 1.0 });

    if (config.resolution !== 'original' && config.resolution.includes('xauto')) {
      targetWidth = parseInt(config.resolution.split('xauto')[0], 10);
      if (isNaN(targetWidth) || targetWidth <= 0) {
        console.warn(`Invalid target width in resolution: ${config.resolution}. Using original width.`);
        gifWidth = Math.max(1, Math.floor(firstPageViewport.width));
        gifHeight = Math.max(1, Math.floor(firstPageViewport.height));
      } else {
        const scale = targetWidth / firstPageViewport.width;
        gifWidth = targetWidth;
        gifHeight = Math.max(1, Math.floor(firstPageViewport.height * scale));
      }
    } else { 
      gifWidth = Math.max(1, Math.floor(firstPageViewport.width));
      gifHeight = Math.max(1, Math.floor(firstPageViewport.height));
    }
    console.log(`Final GIF dimensions set to: ${gifWidth}x${gifHeight}`);

    const encoder = new GIFEncoder(gifWidth, gifHeight, 'octree', true);
    encoder.start();
    encoder.setRepeat(config.looping ? 0 : -1); 
    const frameDelay = Math.max(20, Math.round(1000 / config.frameRate));
    encoder.setDelay(frameDelay);
    encoder.setQuality(10); 

    console.log(`GIFEncoder initialized. Frame rate: ${config.frameRate} FPS, Delay: ${frameDelay}ms.`);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not get 2D rendering context for canvas.');
    }
    
    canvas.width = gifWidth;
    canvas.height = gifHeight;

    for (let i = 1; i <= numPages; i++) {
      const pageProgressStart = 0.1 + (0.8 * (i - 1) / numPages);
      const pageProgressEnd = 0.1 + (0.8 * i / numPages);
      onProgress?.(pageProgressStart);

      console.log(`Processing page ${i} of ${numPages}...`);
      const page = await pdfDoc.getPage(i);
      const originalPageViewport = page.getViewport({ scale: 1.0 });

      const scaleToFit = Math.min(gifWidth / originalPageViewport.width, gifHeight / originalPageViewport.height);
      const scaledViewport = page.getViewport({ scale: scaleToFit });

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.max(1, Math.floor(scaledViewport.width));
      pageCanvas.height = Math.max(1, Math.floor(scaledViewport.height));
      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) {
        throw new Error(`Could not get 2D context for page ${i} canvas.`);
      }
      
      const renderContext = {
        canvasContext: pageContext,
        viewport: scaledViewport,
      } as const;

      console.log(`Rendering page ${i} to temp canvas (${pageCanvas.width}x${pageCanvas.height})...`);
      await page.render(renderContext).promise;
      onProgress?.(pageProgressStart + (pageProgressEnd - pageProgressStart) * 0.8);
      console.log(`Page ${i} rendered to temp canvas.`);

      context.fillStyle = '#FFFFFF'; 
      context.fillRect(0, 0, gifWidth, gifHeight);
      
      const offsetX = (gifWidth - pageCanvas.width) / 2;
      const offsetY = (gifHeight - pageCanvas.height) / 2;
      context.drawImage(pageCanvas, offsetX, offsetY);

      console.log(`Adding frame ${i} to GIF encoder...`);
      encoder.addFrame(context);
      console.log(`Frame ${i} added.`);
      onProgress?.(pageProgressEnd);
    }

    console.log("Cleaning up PDF document resources...");
    if (pdfDoc && typeof pdfDoc.destroy === 'function') await pdfDoc.destroy();
    console.log("PDF document cleanup complete.");
    onProgress?.(0.95);

    console.log("Finalizing GIF...");
    encoder.finish();
    const gifBuffer = encoder.out.getData();
    console.log(`GIF generated successfully. Size: ${(gifBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    onProgress?.(1.0);

    return new Blob([gifBuffer], { type: 'image/gif' });
  } catch (error) {
    console.error("Error during GIF generation:", error);
    if (pdfDoc && typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy().catch(e => console.error("Error destroying PDF doc after error:", e));
    }
    const friendlyMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate GIF: ${friendlyMessage}`);
  }
}
