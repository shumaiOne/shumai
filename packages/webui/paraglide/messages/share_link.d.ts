/**
* | output |
* | --- |
* | "share link" |
*
* @param {Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link: ((inputs?: Share_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Share_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Share_LinkInputs = {};
