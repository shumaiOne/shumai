/**
* | output |
* | --- |
* | "Zoom In" |
*
* @param {Zoom_InInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const zoom_in: ((inputs?: Zoom_InInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Zoom_InInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Zoom_InInputs = {};
