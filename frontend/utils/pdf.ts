import * as pdfjs from 'pdfjs-dist'
// Vite resolves this to a URL string for the worker bundle
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export interface PdfExtraction {
  text: string
  pages: number
}

/**
 * Extracts plain text from a PDF file using pdfjs-dist in the browser.
 * Items in the same page are joined with spaces; pages are joined with newlines
 * with the heading line preserved so server-side parsers can split by structure.
 */
export async function extractPdfText(file: File): Promise<PdfExtraction> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument(data).promise
  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Group items by Y coordinate (line) so we preserve row structure that
    // SLSP statements rely on (e.g. multi-line transaction blocks).
    type Item = { str: string; transform: number[] }
    const items = content.items as Item[]
    const lines = new Map<number, Item[]>()
    for (const it of items) {
      if (!it.str) continue
      const y = Math.round(it.transform[5])
      const arr = lines.get(y) ?? []
      arr.push(it)
      lines.set(y, arr)
    }
    const sortedY = [...lines.keys()].sort((a, b) => b - a) // top → bottom (PDF y grows up)
    const lineStrings: string[] = []
    for (const y of sortedY) {
      const arr = lines.get(y)!
      arr.sort((a, b) => a.transform[4] - b.transform[4])
      const lineText = arr.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim()
      if (lineText) lineStrings.push(lineText)
    }
    pageTexts.push(lineStrings.join('\n'))
  }
  return { text: pageTexts.join('\n'), pages: pdf.numPages }
}
