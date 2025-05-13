//
// PLEASE COPY THE ACTUAL WORKER FILE HERE
//
// This file is a placeholder. You need to copy the actual 'pdf.worker.js'
// from 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js' (or 'node_modules/pdfjs-dist/build/pdf.worker.js' for newer versions)
// to this 'public/pdf.worker.js' location in your project.
//
// The PDF.js library (pdfjs-dist) requires this worker file to be accessible
// in your public directory to perform its operations efficiently without
// blocking the main browser thread.
//
// After copying the file, src/services/gif-generator.ts will use it via:
// pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
//
console.warn(
  "This is a placeholder for 'public/pdf.worker.js'. " +
  "PDF rendering might not work correctly or efficiently. " +
  "Please copy the actual worker file from 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js' (or 'node_modules/pdfjs-dist/build/pdf.worker.js') to this location."
);

// Minimal self-posting worker to avoid immediate errors if not replaced.
// The actual pdf.worker.js is much more complex.
if (typeof self !== 'undefined') {
  self.onmessage = function (event) {
    // The actual worker would handle messages from pdf.js
    // This is just to make it a valid worker script.
    // console.log('Placeholder pdf.worker.js received message:', event.data);
  };
}