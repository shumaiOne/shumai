import { describe, expect, it } from 'vitest'
import { newTablePrinter, withTruncate, withColor } from './index'

class StringWriter {
  content = ''
  write(s: string) {
    this.content += s
  }
}

describe('tableprinter', () => {
  it('tsv mode', () => {
    const writer = new StringWriter()
    const tp = newTablePrinter(writer, false, 80)

    tp.addHeader(['ID', 'Name', 'Size'])
    tp.addField('1')
    tp.addField('apple')
    tp.addField('10')
    tp.endRow()
    tp.addField('2')
    tp.addField('banana')
    tp.addField('20')
    tp.endRow()
    tp.render()

    expect(writer.content).toBe('1\tapple\t10\n2\tbanana\t20\n')
  })

  it('tty mode - no truncation', () => {
    const writer = new StringWriter()
    const tp = newTablePrinter(writer, true, 80)

    tp.addHeader(['ID', 'Name', 'Size'])
    tp.addField('1')
    tp.addField('apple')
    tp.addField('10')
    tp.endRow()
    tp.addField('2')
    tp.addField('banana')
    tp.addField('20')
    tp.endRow()
    tp.render()

    const lines = writer.content.split('\n')
    expect(lines[0]).toBe('ID  Name    Size')
    expect(lines[1]).toBe('1   apple   10')
    expect(lines[2]).toBe('2   banana  20')
  })

  it('tty mode - dynamic truncation to fit viewport', () => {
    const writer = new StringWriter()
    // Very narrow viewport
    const tp = newTablePrinter(writer, true, 20)

    tp.addHeader(['ID', 'LongName'])
    tp.addField('01KV')
    tp.addField('YTDown_YouTube_Ed-Sheeran-Pokemon-Celestial')
    tp.endRow()
    tp.render()

    const lines = writer.content.split('\n').filter(Boolean)
    // Avail width for columns: 20 - 2 (delimiter size) = 18.
    // ID column is 4 chars, leaving 14 chars for LongName.
    // LongName has truncate by default.
    expect(lines[0]).toBe('ID    LongName')
    expect(lines[1]).toBe('01KV  YTDown_YouT...')
  })

  it('tty mode - disabled truncation option', () => {
    const writer = new StringWriter()
    // Narrow viewport
    const tp = newTablePrinter(writer, true, 25)

    // Disable truncation on the first column, keep default on the second
    tp.addHeader(['ID', 'LongName'], withTruncate(null))
    tp.addField('01KVFW2HD6CK9D9H77A341HQP1', withTruncate(null))
    tp.addField('YTDown_YouTube_Ed-Sheeran-Pokemon')
    tp.endRow()
    tp.render()

    const lines = writer.content.split('\n').filter(Boolean)
    // First column is 26 characters and must not be truncated since truncation is disabled.
    expect(lines[1].startsWith('01KVFW2HD6CK9D9H77A341HQP1')).toBe(true)
  })

  it('tty mode - color preservation and display width measurement', () => {
    const writer = new StringWriter()
    const tp = newTablePrinter(writer, true, 80)

    // Red colored title
    const coloredName = '\u001b[31mapple\u001b[0m'
    tp.addHeader(['ID', 'Name'])
    tp.addField('1')
    tp.addField(
      coloredName,
      withColor((s) => `\u001b[31m${s}\u001b[0m`),
    )
    tp.endRow()
    tp.render()

    const lines = writer.content.split('\n')
    // Display width of coloredName should be 5 despite escape sequences.
    expect(lines[0]).toBe('ID  Name')
  })
})
