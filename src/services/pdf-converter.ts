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
      imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w+nky58wtQgAAADqDw9jbfFvgAAAABJRU5ErkJggg==',
    },
  ];
}
