/**
 * Represents a page in a PDF document as an image.
 */
export interface PdfPage {
  /**
   * The image data of the PDF page.
   */
  imageData: string;
}

/**
 * Asynchronously converts a PDF file to a series of images, one for each page.
 *
 * @param pdfFile The PDF file to convert.
 * @returns A promise that resolves to an array of PdfPage objects.
 */
export async function convertPdfToImages(pdfFile: File): Promise<PdfPage[]> {
  // TODO: Implement this by calling an API.
  return [
    {
      imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAcCAYAAAB75n/uAAAAcklEQVRIS+2UMQrDMAyGZ0l97GAHmOVdwlokm7wJhJpjm9+5EQQgU0JeoEkEQTBHBPu15CGEjC6L5s451BwHXwCKwAqYAwLgZxXgC0wAHwEagEYA9cAhcBRoAhcAJ8BVoBHoC7gR9wFZL38V1E5j0v6L+6N9G+g/lG+V8u1HvYPy1cQn97xPwAAAABJRU5ErkJggg==',
    },
        {
      imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAcCAYAAAB75n/uAAAAcklEQVRIS+2UMQrDMAyGZ0l97GAHmOVdwlokm7wJhJpjm9+5EQQgU0JeoEkEQTBHBPu15CGEjC6L5s451BwHXwCKwAqYAwLgZxXgC0wAHwEagEYA9cAhcBRoAhcAJ8BVoBHoC7gR9wFZL38V1E5j0v6L+6N9G+g/lG+V8u1HvYPy1cQn97xPwAAAABJRU5ErkJggg==',
    },
  ];
}
