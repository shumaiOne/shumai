/**
* | output |
* | --- |
* | "Rename Share Link" |
*
* @param {Rename_Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const rename_share_link: ((inputs?: Rename_Share_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Rename_Share_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Rename_Share_LinkInputs = {};
