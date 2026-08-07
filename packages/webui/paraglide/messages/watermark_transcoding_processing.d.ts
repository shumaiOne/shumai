/**
* | output |
* | --- |
* | "Transcoding watermark media..." |
*
* @param {Watermark_Transcoding_ProcessingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_transcoding_processing: ((inputs?: Watermark_Transcoding_ProcessingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Watermark_Transcoding_ProcessingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Watermark_Transcoding_ProcessingInputs = {};
