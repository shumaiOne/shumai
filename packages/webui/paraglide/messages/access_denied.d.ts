/**
* | output |
* | --- |
* | "Access Denied" |
*
* @param {Access_DeniedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const access_denied: ((inputs?: Access_DeniedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Access_DeniedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Access_DeniedInputs = {};
