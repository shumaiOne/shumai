/**
* | output |
* | --- |
* | "Watermark Editor" |
*
* @param {Watermark_EditorInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_editor: ((inputs?: Watermark_EditorInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Watermark_EditorInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Watermark_EditorInputs = {};
