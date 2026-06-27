/**
* | output |
* | --- |
* | "Failed to fetch share link" |
*
* @param {Failed_Fetch_Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_share_link: ((inputs?: Failed_Fetch_Share_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Fetch_Share_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Fetch_Share_LinkInputs = {};
