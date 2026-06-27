/**
* | output |
* | --- |
* | "Failed to fetch share links" |
*
* @param {Failed_Fetch_Share_LinksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_share_links: ((inputs?: Failed_Fetch_Share_LinksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Fetch_Share_LinksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Fetch_Share_LinksInputs = {};
