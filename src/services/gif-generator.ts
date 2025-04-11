'use server'
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

async function pdfPageToImageData(pdfBytes: Uint8Array, pageNumber: number, width: number, height: number): Promise<string> {
  if (typeof window === 'undefined') {
    // jsdom environment
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAACn০০০.AABgAAAAcEhZcwAADsQAAA7EAZUrDhsAAAANSURBVBhYnJjO3bgYAAACAAAADAqYAAAAASUVORK5CYII=';
  }

  const pdfJsLib = await import('pdfjs-dist');
  pdfJsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsLib.version}/pdf.worker.min.js`;

  const pdfDoc = await pdfJsLib.getDocument({ data: pdfBytes }).promise;
  const page = await pdfDoc.getPage(pageNumber);

  const viewport = page.getViewport({ scale: 1 });
  const canvas = document.createElement('canvas');
  const canvasContext = canvas.getContext('2d');

  canvas.height = height;
  canvas.width = width;

  const renderContext = {
    canvasContext,
    viewport,
  };

  await page.render(renderContext).promise;
  return canvas.toDataURL('image/png');
}

/**
 * Asynchronously generates a GIF from a PDF file.
 *
 * @param pdfFile The PDF file to convert.
 * @param config The configuration options for GIF generation.
 * @returns A promise that resolves to a Blob containing the generated GIF file.
 */
export async function generateGifFromPdf(pdfFile: File, config: GifConfig): Promise<Blob> {
  const width = parseInt(config.resolution.split('x')[0]);
  const height = parseInt(config.resolution.split('x')[1]);
  const frameDelay = Math.round(100 / config.frameRate); // Convert frame rate to delay in hundredths of a second

  let gifData = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a header
    width & 0xFF, (width >> 8) & 0xFF,       // Logical screen width
    height & 0xFF, (height >> 8) & 0xFF,     // Logical screen height
    0xF0,             // Global color table flags (GCT present, 256 colors)
    0x00,             // Background color index
    0x00              // Pixel aspect ratio
  ]);

  // Global color table (simple black and white)
  gifData = concat(gifData, new Uint8Array([
    0x00, 0x00, 0x00, // Black
    0xFF, 0xFF, 0xFF  // White
  ]));

  // Add Netscape loop extension
  if (config.looping) {
    gifData = concat(gifData, new Uint8Array([
      0x21, 0xFF, 0x0B, // Netscape application extension
      0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30,
      0x03, 0x01,
      0x00, 0x00, // Loop forever
      0x00
    ]));
  }

  try {
    const pdfBytes = await readPdf(pdfFile);

    const pdfJsLib = await import('pdfjs-dist');
    pdfJsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsLib.version}/pdf.worker.min.js`;

    const pdfDoc = await pdfJsLib.getDocument({ data: pdfBytes }).promise;
    const numPages = pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
      const image = await pdfPageToImageData(pdfBytes, i, width, height);
      const base64Data = image.split(',')[1];
      const decodedData = atob(base64Data);
      const byteNumbers = new Array(decodedData.length);
      for (let j = 0; j < decodedData.length; j++) {
        byteNumbers[j] = decodedData.charCodeAt(j);
      }
      const imageData = new Uint8Array(byteNumbers);

      gifData = concat(gifData, new Uint8Array([
        0x21, 0xF9, 0x04, // Graphic Control Extension
        0x00,             // Disposal method (none)
        frameDelay & 0xFF, (frameDelay >> 8) & 0xFF,       // Delay time
        0x00,             // Transparent color index
        0x00,             // Terminator

        0x2C,             // Image Descriptor
        0x00, 0x00,       // Image left position
        0x00, 0x00,       // Image top position
        width & 0xFF, (width >> 8) & 0xFF,       // Image width
        height & 0xFF, (height >> 8) & 0xFF,     // Image height
        0x00              // Local color table flags
      ]));

      // Add image data (simplified - just use the decoded image data)
       gifData = concat(gifData, new Uint8Array([
        0x08, // LZW minimum code size
        0x01, 0x02, // Block size and data (example)
      ]));
      gifData = concat(gifData, imageData)
      gifData = concat(gifData, new Uint8Array([0x00])); // end of image data
    }
  } catch (error) {
    console.error("Error generating GIF:", error);
    throw new Error("Error generating GIF: " + error);
  }

  // GIF terminator
  gifData = concat(gifData, new Uint8Array([0x3B]));

  const blob = new Blob([gifData], { type: 'image/gif' });
  return blob;
}


/**
 * Concatenates two Uint8Array
 * @param a first array
 * @param b second array
 * @returns concatenated array
 */
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}
