import { describe, expect, it } from 'vitest'
import {
  isXmpFileTags,
  isXmpSidecarName,
  pairSidecars,
  parseXmpSidecar,
  xmpFromTags,
  xmpMetadataUpdates,
  xmpStem,
  type FolderEntry,
} from './xmp-sidecar'

const DARKTABLE_XMP = `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 4.4.0-Exiv2">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
    xmlns:darktable="http://darktable.sf.net/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:lr="http://ns.adobe.com/lightroom/1.0/"
   xmp:Rating="4"
   xmp:Label="Green"
   xmpMM:DerivedFrom="DSCF1234.RAF"
   darktable:xmp_version="5"
   darktable:raw_params="0"
   darktable:auto_presets_applied="1"
   darktable:history_end="1">
   <dc:subject>
    <rdf:Bag>
     <rdf:li>wedding</rdf:li>
     <rdf:li>2026</rdf:li>
    </rdf:Bag>
   </dc:subject>
   <lr:hierarchicalSubject>
    <rdf:Bag>
     <rdf:li>places|France|Paris</rdf:li>
     <rdf:li>Wedding</rdf:li>
    </rdf:Bag>
   </lr:hierarchicalSubject>
   <darktable:history>
    <rdf:Seq>
     <rdf:li darktable:num="0" darktable:operation="exposure" darktable:enabled="1" darktable:modversion="6" darktable:params="00000000" darktable:multi_name="" darktable:multi_priority="0"/>
    </rdf:Seq>
   </darktable:history>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
`

const LIGHTROOM_XMP = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000 1.000000, 0000/00/00-00:00:00">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    xmlns:lr="http://ns.adobe.com/lightroom/1.0/"
   xmp:Rating="2"
   xmp:Label="Red"
   crs:Version="15.0"
   crs:Exposure2012="+0.35">
   <dc:subject>
    <rdf:Bag>
     <rdf:li>portrait</rdf:li>
    </rdf:Bag>
   </dc:subject>
   <lr:hierarchicalSubject>
    <rdf:Bag>
     <rdf:li>people|clients|Ana</rdf:li>
    </rdf:Bag>
   </lr:hierarchicalSubject>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

const REJECTED_XMP = `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:Rating="-1"/>
 </rdf:RDF>
</x:xmpmeta>
`

const NO_FIELDS_XMP = `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:darktable="http://darktable.sf.net/" darktable:xmp_version="5"/>
 </rdf:RDF>
</x:xmpmeta>
`

describe('parseXmpSidecar', () => {
  it('reads a darktable sidecar', async () => {
    const xmp = await parseXmpSidecar(DARKTABLE_XMP)
    expect(xmp).toEqual({
      rating: 4,
      rejected: false,
      label: 'Green',
      // "Wedding" from the hierarchy repeats "wedding" and is dropped; "Paris" is the path leaf.
      keywords: ['wedding', '2026', 'Paris'],
    })
  })

  it('reads a Lightroom sidecar', async () => {
    const xmp = await parseXmpSidecar(Buffer.from(LIGHTROOM_XMP, 'utf8'))
    expect(xmp).toEqual({
      rating: 2,
      rejected: false,
      label: 'Red',
      keywords: ['portrait', 'Ana'],
    })
  })

  it('treats a rating of -1 as rejected', async () => {
    const xmp = await parseXmpSidecar(REJECTED_XMP)
    expect(xmp).toEqual({ rating: undefined, rejected: true, label: undefined, keywords: [] })
  })

  it('returns null when the sidecar has no rating, label or keywords', async () => {
    expect(await parseXmpSidecar(NO_FIELDS_XMP)).toBeNull()
  })

  it('ignores a JPEG renamed to .xmp even when it carries an XMP rating', async () => {
    // A minimal JPEG whose APP1 segment holds an XMP packet with a rating and a label.
    const packet = Buffer.from(
      `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>${DARKTABLE_XMP}<?xpacket end="w"?>`,
      'utf8',
    )
    const header = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1')
    const length = Buffer.alloc(2)
    length.writeUInt16BE(2 + header.length + packet.length)
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
      length,
      header,
      packet,
      Buffer.from([0xff, 0xd9]),
    ])
    expect(await parseXmpSidecar(jpeg)).toBeNull()
  })

  it('returns null for malformed XML without throwing', async () => {
    expect(await parseXmpSidecar('<x:xmpmeta><rdf:RDF><rdf:Description xmp:Rating="4"')).toBeNull()
    expect(await parseXmpSidecar('this is not xml at all \u0000\u0001')).toBeNull()
    expect(await parseXmpSidecar('')).toBeNull()
    expect(await parseXmpSidecar(Buffer.alloc(0))).toBeNull()
  })

  describe('with a DOCTYPE that defines entities', () => {
    const withDoctype = (doctype: string, label: string, keyword: string) =>
      `<?xml version="1.0"?>
${doctype}
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmp:Rating="3" xmp:Label="${label}">
   <dc:subject><rdf:Bag><rdf:li>${keyword}</rdf:li></rdf:Bag></dc:subject>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
`

    it('does not read local files through external entities (XXE)', async () => {
      const xmp = await parseXmpSidecar(
        withDoctype(
          '<!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini"><!ENTITY pw SYSTEM "file:///etc/passwd">]>',
          '&xxe;',
          '&pw;',
        ),
      )
      // The rest of the file is still read, and the entity references stay as literal text.
      expect(xmp?.rating).toBe(3)
      expect(xmp?.label).toBe('&xxe;')
      expect(xmp?.keywords).toEqual(['&pw;'])
      expect(JSON.stringify(xmp)).not.toMatch(/\[fonts\]|for 16-bit|root:/i)
    })

    it('does not expand nested entities (billion laughs)', async () => {
      const started = Date.now()
      const xmp = await parseXmpSidecar(
        withDoctype(
          `<!DOCTYPE lolz [<!ENTITY a "lol"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;"><!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">]>`,
          '&d;',
          '&d;',
        ),
      )
      expect(Date.now() - started).toBeLessThan(10_000)
      expect(xmp?.rating).toBe(3)
      expect(xmp?.label).toBe('&d;')
    })
  })
})

describe('isXmpFileTags', () => {
  it('accepts an XMP file by its type or MIME type only', () => {
    expect(isXmpFileTags({ FileType: 'XMP' })).toBe(true)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    expect(isXmpFileTags({ MIMEType: 'application/rdf+xml' })).toBe(true)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    expect(isXmpFileTags({ FileType: 'JPEG', MIMEType: 'image/jpeg' })).toBe(false)
    expect(isXmpFileTags({})).toBe(false)
  })
})

describe('xmpFromTags', () => {
  it('accepts a single keyword given as a string or a number', () => {
    expect(
      xmpFromTags({ Subject: 'solo' as unknown as string[], HierarchicalSubject: undefined }),
    ).toEqual({ rating: undefined, rejected: false, label: undefined, keywords: ['solo'] })
    expect(xmpFromTags({ Subject: [2024, 'x'] as unknown as string[] })?.keywords).toEqual([
      '2024',
      'x',
    ])
  })

  it('keeps 5 as the highest rating and ignores 0', () => {
    expect(xmpFromTags({ Rating: 9, Label: 'Blue' })?.rating).toBe(5)
    expect(xmpFromTags({ Rating: 0 })).toEqual({
      rating: undefined,
      rejected: false,
      label: undefined,
      keywords: [],
    })
  })

  it('returns null when nothing is set', () => {
    expect(xmpFromTags({})).toBeNull()
    expect(xmpFromTags({ Label: '   ', Subject: [] })).toBeNull()
  })
})

describe('xmpMetadataUpdates', () => {
  it('writes every field and nulls the ones the sidecar lacks', () => {
    expect(
      xmpMetadataUpdates({ rating: 3, rejected: false, label: undefined, keywords: ['a', 'b'] }),
    ).toEqual([
      { key: 'xmp_rating', value: 3 },
      { key: 'xmp_rejected', value: null },
      { key: 'xmp_label', value: null },
      { key: 'xmp_keywords', value: 'a, b' },
    ])
  })

  it('marks a rejected photo', () => {
    const updates = xmpMetadataUpdates({ rejected: true, keywords: [] })
    expect(updates.find((u) => u.key === 'xmp_rejected')?.value).toBe(true)
    expect(updates.find((u) => u.key === 'xmp_rating')?.value).toBeNull()
  })

  it('clears everything for no sidecar', () => {
    expect(xmpMetadataUpdates(null).every((u) => u.value === null)).toBe(true)
  })
})

describe('sidecar names', () => {
  it('recognises .xmp in any case and rejects hidden or bare names', () => {
    expect(isXmpSidecarName('DSCF1234.RAF.xmp')).toBe(true)
    expect(isXmpSidecarName('dscf1234.XMP')).toBe(true)
    expect(isXmpSidecarName('.xmp')).toBe(false)
    expect(isXmpSidecarName('._DSCF1234.xmp')).toBe(false)
    expect(isXmpSidecarName('photo.xmp.bak')).toBe(false)
  })

  it('gives the shared stem for media and both sidecar styles', () => {
    expect(xmpStem('DSCF1234.RAF')).toBe('DSCF1234')
    expect(xmpStem('DSCF1234.RAF.xmp')).toBe('DSCF1234')
    expect(xmpStem('DSCF1234.xmp')).toBe('DSCF1234')
    expect(xmpStem('README')).toBe('README')
  })
})

describe('pairSidecars', () => {
  let n = 0
  const entry = (name: string, ageMs = 0): FolderEntry => ({
    id: `${name}#${n++}`,
    name,
    createdAt: new Date(1_700_000_000_000 - ageMs),
  })
  const pairNames = (entries: FolderEntry[]) => {
    const byId = new Map(entries.map((e) => [e.id, e.name]))
    return Object.fromEntries(
      [...pairSidecars(entries)].map(([m, s]) => [byId.get(m), byId.get(s)]),
    )
  }

  it('pairs the darktable style, ignoring case', () => {
    expect(pairNames([entry('DSCF1234.RAF'), entry('dscf1234.raf.XMP')])).toEqual({
      'DSCF1234.RAF': 'dscf1234.raf.XMP',
    })
  })

  it('pairs the Lightroom style, ignoring case', () => {
    expect(
      pairNames([entry('IMG_0001.CR3'), entry('img_0001.xmp'), entry('IMG_0002.CR3')]),
    ).toEqual({ 'IMG_0001.CR3': 'img_0001.xmp' })
  })

  it('prefers the exact darktable sidecar over the shared one', () => {
    expect(pairNames([entry('A.RAF'), entry('A.xmp'), entry('A.RAF.xmp')])).toEqual({
      'A.RAF': 'A.RAF.xmp',
    })
  })

  it('gives a shared sidecar only to the RAW file of a RAW plus JPEG pair', () => {
    expect(pairNames([entry('A.RAF'), entry('A.JPG'), entry('A.xmp')])).toEqual({
      'A.RAF': 'A.xmp',
    })
  })

  it('gives a shared sidecar to every non-RAW file when there is no RAW file', () => {
    expect(pairNames([entry('A.JPG'), entry('A.tif'), entry('A.xmp')])).toEqual({
      'A.JPG': 'A.xmp',
      'A.tif': 'A.xmp',
    })
  })

  it('lets an exact darktable sidecar attach to a non-RAW file even beside a RAW pair', () => {
    expect(pairNames([entry('A.RAF'), entry('A.JPG'), entry('A.JPG.xmp')])).toEqual({
      'A.JPG': 'A.JPG.xmp',
    })
  })

  it('uses the newest sidecar when a name is uploaded twice', () => {
    const older = entry('A.RAF.xmp', 5000)
    const newer = entry('A.RAF.xmp', 0)
    const media = entry('A.RAF')
    expect(pairSidecars([older, media, newer]).get(media.id)).toBe(newer.id)
  })

  it('does not pair unrelated names, hidden files or darktable duplicates', () => {
    expect(
      pairNames([
        entry('A.RAF'),
        entry('AB.xmp'),
        entry('A_01.RAF.xmp'),
        entry('._A.xmp'),
        entry('B.xmp'),
      ]),
    ).toEqual({})
  })

  it('does not treat a sidecar as media for another sidecar', () => {
    expect(pairNames([entry('A.xmp'), entry('A.RAF.xmp')])).toEqual({})
  })
})
