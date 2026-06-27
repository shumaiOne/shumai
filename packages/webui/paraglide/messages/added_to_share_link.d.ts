/**
* | output |
* | --- |
* | "Added to share link" |
*
* @param {Added_To_Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const added_to_share_link: ((inputs?: Added_To_Share_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Added_To_Share_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Added_To_Share_LinkInputs = {};
