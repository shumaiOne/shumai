import type { ExportAssetMetadata, ExportCommentItem, ExportOptions, ExportResult } from '../types'
import { formatDatePremiere, isDropFrameRate, secondToFrame } from '../timecode'

const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const exportToPremiereXml = (
  metadata: ExportAssetMetadata,
  comments: ExportCommentItem[],
  options?: ExportOptions,
): ExportResult => {
  const exportDate = options?.exportDate || new Date()
  const dateStr = formatDatePremiere(exportDate)
  const isNtsc = isDropFrameRate(metadata.fps)
  const timebase = Math.round(metadata.fps) || 24
  const duration = metadata.totalFrames || Math.round(metadata.duration * metadata.fps) || 0
  const width = metadata.width || 1920
  const height = metadata.height || 1080

  // Sort comments: timestamped first, then non-timestamped
  const timed = comments.filter((c) => c.second !== null && c.second !== undefined)
  timed.sort((a, b) => (a.second ?? 0) - (b.second ?? 0))
  const notimed = comments.filter((c) => c.second === null || c.second === undefined)

  const allSorted = [...timed, ...notimed]

  const markerXmlBlocks: string[] = []
  allSorted.forEach((comment, index) => {
    const isTimed = comment.second !== null && comment.second !== undefined
    const inFrame = isTimed ? secondToFrame(comment.second, metadata.fps) : 0
    const markerIndent = index === 0 ? '              <marker>' : '  <marker>'

    markerXmlBlocks.push(`${markerIndent}
    <comment>${escapeXml(comment.message || '')}</comment>
    <name>${escapeXml(comment.creator.name)}</name>
    <in>${inFrame}</in>
    <out>-1</out>
    <pproColor>4294741314</pproColor>
  </marker>`)

    const replies = comment.replies || []
    replies.forEach((r) => {
      markerXmlBlocks.push(`  <marker>
    <comment>${escapeXml(r.message || '')}</comment>
    <name>${escapeXml(r.creator.name)}</name>
    <in>${inFrame}</in>
    <out>-1</out>
    <pproColor>4294741314</pproColor>
  </marker>`)
    })
  })

  const clipMarkersJoined = markerXmlBlocks.join('\n')

  // Sequence markers have slightly different initial indent (6 spaces instead of 14)
  const seqMarkerBlocks = [...markerXmlBlocks]
  if (seqMarkerBlocks.length > 0) {
    seqMarkerBlocks[0] = seqMarkerBlocks[0].replace('              <marker>', '      <marker>')
  }
  const seqMarkersJoined = seqMarkerBlocks.join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence id="sequence" TL.SQAudioVisibleBase="0" TL.SQVideoVisibleBase="0" TL.SQVisibleBaseTime="0" TL.SQAVDividerPosition="0.5" TL.SQHideShyTracks="0" TL.SQHeaderWidth="292" Monitor.ProgramZoomOut="0" Monitor.ProgramZoomIn="0" TL.SQTimePerPixel="0.19999999999999998" MZ.EditLine="0" MZ.Sequence.PreviewFrameSizeHeight="${height}" MZ.Sequence.PreviewFrameSizeWidth="${width}" MZ.Sequence.AudioTimeDisplayFormat="200" MZ.Sequence.PreviewRenderingClassID="1061109567" MZ.Sequence.PreviewRenderingPresetCodec="1634755439" MZ.Sequence.PreviewRenderingPresetPath="EncoderPresets/SequencePreview/795454d9-d3c2-429d-9474-923ab13b7018/QuickTime.epr" MZ.Sequence.PreviewUseMaxRenderQuality="false" MZ.Sequence.PreviewUseMaxBitDepth="false" MZ.Sequence.EditingModeGUID="795454d9-d3c2-429d-9474-923ab13b7018" MZ.Sequence.VideoTimeDisplayFormat="101" MZ.WorkOutPoint="4612930560000" MZ.WorkInPoint="0" explodedTracks="true">
    <uuid>7dcf0da5-fbe2-4459-adcc-aa46dd4e3822</uuid>
    <duration>${duration}</duration>
    <rate>
      <timebase>${timebase}</timebase>
      <ntsc>${isNtsc ? 'TRUE' : 'FALSE'}</ntsc>
    </rate>
    <name>${escapeXml(metadata.name)} ${dateStr}</name>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>${isNtsc ? 'TRUE' : 'FALSE'}</ntsc>
            </rate>
            <codec>
              <name>Apple ProRes 422</name>
              <appspecificdata>
                <appname>Final Cut Pro</appname>
                <appmanufacturer>Apple Inc.</appmanufacturer>
                <appversion>7.0</appversion>
                <data>
                  <qtcodec>
                    <codecname>Apple ProRes 422</codecname>
                    <codectypename>Apple ProRes 422</codectypename>
                    <codecname>Apple ProRes 422</codecname>
                    <codectypecode>apcn</codectypecode>
                    <codecvendorcode>appl</codecvendorcode>
                    <spatialquality>1024</spatialquality>
                    <temporalquality>0</temporalquality>
                    <keyframerate>0</keyframerate>
                    <datarate>0</datarate>
                  </qtcodec>
                </data>
              </appspecificdata>
            </codec>
            <width>${width}</width>
            <height>${height}</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
            <colordepth>24</colordepth>
          </samplecharacteristics>
        </format>
        <track TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="0">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <generatoritem id="clipitem-1">
            <name>Marker Color Matte (${dateStr})</name>
            <enabled>TRUE</enabled>
            <duration>${duration}</duration>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>${isNtsc ? 'TRUE' : 'FALSE'}</ntsc>
            </rate>
            <start>0</start>
            <end>${duration}</end>
            <in>0</in>
            <out>${duration}</out>
            <alphatype>none</alphatype>
            <effect>
              <name>Color</name>
              <effectid>Color</effectid>
              <effectcategory>Matte</effectcategory>
              <effecttype>generator</effecttype>
              <mediatype>video</mediatype>
              <parameter authoringApp="PremierePro">
                <parameterid>fillcolor</parameterid>
                <name>Color</name>
                <value>
                  <alpha>0</alpha>
                  <red>0</red>
                  <green>0</green>
                  <blue>0</blue>
                </value>
              </parameter>
            </effect>
            <filter>
              <effect>
                <name>Opacity</name>
                <effectid>opacity</effectid>
                <effectcategory>motion</effectcategory>
                <effecttype>motion</effecttype>
                <mediatype>video</mediatype>
                <pproBypass>false</pproBypass>
                <parameter authoringApp="PremierePro">
                  <parameterid>opacity</parameterid>
                  <name>opacity</name>
                  <valuemin>0</valuemin>
                  <valuemax>100</valuemax>
                  <value>0</value>
                </parameter>
              </effect>
            </filter>
${clipMarkersJoined}

          </generatoritem>
        </track>
      </video>
      <audio>
        <numOutputChannels>2</numOutputChannels>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>48000</samplerate>
          </samplecharacteristics>
        </format>
        <outputs>
          <groups>
            <index>1</index>
            <numchannels>1</numchannels>
            <downmix>0</downmix>
            <channel>
              <index>1</index>
            </channel>
          </groups>
          <groups>
            <index>2</index>
            <numchannels>1</numchannels>
            <downmix>0</downmix>
            <channel>
              <index>2</index>
            </channel>
          </groups>
        </outputs>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="0" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>1</outputchannelindex>
        </track>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="1" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>2</outputchannelindex>
        </track>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="0" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>1</outputchannelindex>
        </track>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="1" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>2</outputchannelindex>
        </track>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="0" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>1</outputchannelindex>
        </track>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="1" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>2</outputchannelindex>
        </track>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="0" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>1</outputchannelindex>
        </track>
        <track TL.SQTrackAudioKeyframeStyle="0" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25" TL.SQTrackExpanded="0" MZ.TrackTargeted="1" PannerCurrentValue="0.5" PannerIsInverted="true" PannerStartKeyframe="-91445760000000000,0.5,0,0,0,0,0,0" PannerName="Balance" currentExplodedTrackIndex="1" totalExplodedTrackCount="2" premiereTrackType="Stereo">
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          <outputchannelindex>2</outputchannelindex>
        </track>
      </audio>
    </media>
    <timecode>
      <rate>
        <timebase>${timebase}</timebase>
        <ntsc>${isNtsc ? 'TRUE' : 'FALSE'}</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>${isNtsc ? 'DF' : 'NDF'}</displayformat>
    </timecode>
    <labels>
      <label2>Iris</label2>
    </labels>
    <logginginfo>
      <description/>
      <scene/>
      <shottake/>
      <lognote/>
      <good/>
      <originalvideofilename/>
      <originalaudiofilename/>
    </logginginfo>
${seqMarkersJoined}

  </sequence>
</xmeml>
`

  const baseName = metadata.name.replace(/\.[^/.]+$/, '')
  return {
    content: xml,
    filename: `${baseName}_premiere.xml`,
    mimeType: 'application/xml; charset=utf-8',
  }
}
