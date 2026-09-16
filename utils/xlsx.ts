import JSZip from 'jszip'

export type XlsxCell = string | number | null | undefined

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/** 0 -> A, 25 -> Z, 26 -> AA */
function columnName(index: number): string {
  let name = ''
  let n = index
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name
    n = Math.floor(n / 26) - 1
  }
  return name
}

/** Excel giới hạn tên sheet 31 ký tự và cấm một số ký tự. */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim()
  return cleaned.slice(0, 31) || 'Sheet1'
}

function buildCellXml(ref: string, value: XlsxCell): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  // Dùng inline string để khỏi phải sinh thêm sharedStrings.xml.
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    String(value)
  )}</t></is></c>`
}

function buildSheetXml(rows: XlsxCell[][], columnWidths?: number[]): string {
  const cols = columnWidths?.length
    ? `<cols>${columnWidths
        .map(
          (w, i) =>
            `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
        )
        .join('')}</cols>`
    : ''

  const sheetData = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => buildCellXml(`${columnName(c)}${r + 1}`, value))
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetData}</sheetData></worksheet>`
}

/**
 * Tạo file .xlsx tối giản (một sheet) từ mảng hai chiều.
 * Dùng JSZip có sẵn thay vì thêm thư viện Excel vào bundle.
 */
export async function buildXlsxBlob(
  sheetName: string,
  rows: XlsxCell[][],
  columnWidths?: number[]
): Promise<Blob> {
  const zip = new JSZip()

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
  )

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  )

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(
      sanitizeSheetName(sheetName)
    )}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  )

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
  )

  zip.file('xl/worksheets/sheet1.xml', buildSheetXml(rows, columnWidths))

  return zip.generateAsync({ type: 'blob', mimeType: XLSX_MIME })
}

/** Tạo file .xlsx rồi tải về ngay trên trình duyệt. */
export async function downloadXlsx(
  fileName: string,
  sheetName: string,
  rows: XlsxCell[][],
  columnWidths?: number[]
): Promise<void> {
  const blob = await buildXlsxBlob(sheetName, rows, columnWidths)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
