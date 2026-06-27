/**
* | output |
* | --- |
* | "Add to Share Links" |
*
* @param {Add_To_Share_LinksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_to_share_links: ((inputs?: Add_To_Share_LinksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_To_Share_LinksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_To_Share_LinksInputs = {};
