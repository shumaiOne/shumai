/**
* | output |
* | --- |
* | "Watermark disabled" |
*
* @param {Watermark_Disabled_MsgInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_disabled_msg: ((inputs?: Watermark_Disabled_MsgInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Watermark_Disabled_MsgInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Watermark_Disabled_MsgInputs = {};
