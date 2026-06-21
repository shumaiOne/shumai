import { displayWidth, padRight, truncate } from './text'

export interface TableField {
  text: string
  truncateFunc?: (width: number, val: string) => string
  paddingFunc?: (width: number, val: string) => string
  colorFunc?: (val: string) => string
}

export type FieldOption = (field: TableField) => void

export interface TablePrinter {
  addHeader(columns: string[], ...opts: FieldOption[]): void
  addField(s: string, ...opts: FieldOption[]): void
  endRow(): void
  render(): void
}

export function withTruncate(fn: ((width: number, val: string) => string) | null): FieldOption {
  return (f: TableField) => {
    f.truncateFunc = fn ?? undefined
  }
}

export function withPadding(fn: ((width: number, val: string) => string) | null): FieldOption {
  return (f: TableField) => {
    f.paddingFunc = fn ?? undefined
  }
}

export function withColor(fn: (val: string) => string): FieldOption {
  return (f: TableField) => {
    f.colorFunc = fn
  }
}

export interface Writer {
  write(s: string): void
}

export function newTablePrinter(w: Writer, isTty: boolean, maxWidth: number): TablePrinter {
  if (isTty) {
    return new TtyTablePrinter(w, maxWidth)
  }
  return new TsvTablePrinter(w)
}

class TtyTablePrinter implements TablePrinter {
  private hasHeaders = false
  private rows: TableField[][] = []

  constructor(
    private out: Writer,
    private maxWidth: number,
  ) {}

  addHeader(columns: string[], ...opts: FieldOption[]): void {
    if (this.hasHeaders) return
    this.hasHeaders = true
    for (const column of columns) {
      this.addField(column, ...opts)
    }
    this.endRow()
  }

  addField(s: string, ...opts: FieldOption[]): void {
    if (this.rows.length === 0) {
      this.rows.push([])
    }
    const rowI = this.rows.length - 1
    const field: TableField = {
      text: s,
      truncateFunc: truncate,
    }
    for (const opt of opts) {
      opt(field)
    }
    this.rows[rowI].push(field)
  }

  endRow(): void {
    this.rows.push([])
  }

  render(): void {
    // Filter out trailing empty rows if any
    const activeRows = this.rows.filter((row) => row.length > 0)
    if (activeRows.length === 0) return

    const delim = '  '
    const numCols = activeRows[0].length
    const colWidths = this.calculateColumnWidths(activeRows, delim.length)

    for (const row of activeRows) {
      for (let col = 0; col < row.length; col++) {
        if (col >= numCols) break
        const field = row[col]
        if (col > 0) {
          this.out.write(delim)
        }

        let truncVal = field.text
        if (field.truncateFunc) {
          truncVal = field.truncateFunc(colWidths[col], field.text)
        }

        if (field.paddingFunc) {
          truncVal = field.paddingFunc(colWidths[col], truncVal)
        } else if (col < numCols - 1) {
          truncVal = padRight(colWidths[col], truncVal)
        }

        if (field.colorFunc) {
          truncVal = field.colorFunc(truncVal)
        }

        this.out.write(truncVal)
      }
      if (row.length > 0) {
        this.out.write('\n')
      }
    }
  }

  private calculateColumnWidths(activeRows: TableField[][], delimSize: number): number[] {
    const numCols = activeRows[0].length
    const maxColWidths = new Array(numCols).fill(0)
    const colWidths = new Array(numCols).fill(0)

    for (const row of activeRows) {
      for (let col = 0; col < row.length; col++) {
        if (col >= numCols) break
        const field = row[col]
        const w = displayWidth(field.text)
        if (w > maxColWidths[col]) {
          maxColWidths[col] = w
        }
        // if this field has disabled truncating, ensure that the column is wide enough
        if (field.truncateFunc === undefined && w > colWidths[col]) {
          colWidths[col] = w
        }
      }
    }

    const getAvailWidth = (): number => {
      let setWidths = 0
      for (let col = 0; col < numCols; col++) {
        setWidths += colWidths[col]
      }
      return this.maxWidth - delimSize * (numCols - 1) - setWidths
    }

    const getNumFixedCols = (): number => {
      let fixedCols = 0
      for (let col = 0; col < numCols; col++) {
        if (colWidths[col] > 0) {
          fixedCols++
        }
      }
      return fixedCols
    }

    // set the widths of short columns
    let w = getAvailWidth()
    if (w > 0) {
      const numFlexColumns = numCols - getNumFixedCols()
      if (numFlexColumns > 0) {
        const perColumn = Math.floor(w / numFlexColumns)
        for (let col = 0; col < numCols; col++) {
          if (colWidths[col] === 0) {
            const max = maxColWidths[col]
            if (max < perColumn) {
              colWidths[col] = max
            }
          }
        }
      }
    }

    // truncate long columns to the remaining available width
    w = getAvailWidth()
    const numFlexColsCount = numCols - getNumFixedCols()
    if (numFlexColsCount > 0) {
      const perColumn = Math.floor(w / numFlexColsCount)
      for (let col = 0; col < numCols; col++) {
        if (colWidths[col] === 0) {
          const max = maxColWidths[col]
          if (max < perColumn) {
            colWidths[col] = max
          } else if (perColumn > 0) {
            colWidths[col] = perColumn
          }
        }
      }
    }

    // add the remainder to truncated columns
    w = getAvailWidth()
    if (w > 0) {
      for (let col = 0; col < numCols; col++) {
        const d = maxColWidths[col] - colWidths[col]
        let toAdd = w
        if (d < toAdd) {
          toAdd = d
        }
        colWidths[col] += toAdd
        w -= toAdd
        if (w <= 0) {
          break
        }
      }
    }

    return colWidths
  }
}

class TsvTablePrinter implements TablePrinter {
  private currentCol = 0

  constructor(private out: Writer) {}

  addHeader(): void {}

  addField(s: string): void {
    if (this.currentCol > 0) {
      this.out.write('\t')
    }
    this.out.write(s)
    this.currentCol++
  }

  endRow(): void {
    this.out.write('\n')
    this.currentCol = 0
  }

  render(): void {}
}
