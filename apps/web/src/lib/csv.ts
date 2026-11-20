export type CsvCell = string | number | null | undefined

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : ''
  // Neutralize spreadsheet formula injection for text cells.
  const text = FORMULA_TRIGGERS.test(cell) ? `'${cell}` : cell
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Builds RFC 4180-style CSV text (CRLF line endings). */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','))
  return lines.join('\r\n')
}

/** Triggers a browser download. A BOM is added so Excel reads UTF-8 correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
