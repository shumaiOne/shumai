/**
* | output |
* | --- |
* | "Templates" |
*
* @param {Watermark_TemplatesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const watermark_templates: ((inputs?: Watermark_TemplatesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Watermark_TemplatesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Watermark_TemplatesInputs = {};
