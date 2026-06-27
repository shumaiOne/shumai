/**
* | output |
* | --- |
* | "No share links created yet." |
*
* @param {No_Share_Links_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_share_links_yet: ((inputs?: No_Share_Links_YetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Share_Links_YetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Share_Links_YetInputs = {};
