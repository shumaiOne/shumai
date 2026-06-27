/**
* | output |
* | --- |
* | "This share link has expired" |
*
* @param {Share_Link_ExpiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link_expired: ((inputs?: Share_Link_ExpiredInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Share_Link_ExpiredInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Share_Link_ExpiredInputs = {};
