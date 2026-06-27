/**
* | output |
* | --- |
* | "Share Expired" |
*
* @param {Share_ExpiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_expired: ((inputs?: Share_ExpiredInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Share_ExpiredInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Share_ExpiredInputs = {};
