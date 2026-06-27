/**
* | output |
* | --- |
* | "Share link renamed" |
*
* @param {Share_Link_RenamedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link_renamed: ((inputs?: Share_Link_RenamedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Share_Link_RenamedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Share_Link_RenamedInputs = {};
