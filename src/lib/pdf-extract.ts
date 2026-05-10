/**
 * Server-side PDF text extraction.
 *
 * Mirrors the line-grouping strategy used in frontend/utils/pdf.ts so SLSP
 * statements parse identically whether they come in via the browser upload
 * or via the Resend inbound webhook.
 */

interface PdfTextItem {
  str: string
  transform: number[]
}

let pdfjsModulePromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null

async function loadPdfjs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  return pdfjsModulePromise
}

export async function extractPdfText(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs()
  const data =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer instanceof ArrayBuffer ? buffer : new ArrayBuffer(0))

  const pdf = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    // Suppress noisy worker warnings — for text extraction we don't need a worker
    disableFontFace: true,
  } as { data: Uint8Array; isEvalSupported: boolean; useSystemFonts: boolean; disableFontFace: boolean })
    .promise

  const pageTexts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items = content.items as PdfTextItem[]
    const lines = new Map<number, PdfTextItem[]>()
    for (const it of items) {
      if (!it.str) continue
      const y = Math.round(it.transform[5])
      const arr = lines.get(y) ?? []
      arr.push(it)
      lines.set(y, arr)
    }
    const sortedY = [...lines.keys()].sort((a, b) => b - a)
    const lineStrings: string[] = []
    for (const y of sortedY) {
      const arr = lines.get(y)!
      arr.sort((a, b) => a.transform[4] - b.transform[4])
      const lineText = arr
        .map((it) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (lineText) lineStrings.push(lineText)
    }
    pageTexts.push(lineStrings.join('\n'))
  }
  return pageTexts.join('\n')
}
