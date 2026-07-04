/**
* | output |
* | --- |
* | "Switch version" |
*
* @param {Switch_VersionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const switch_version: ((inputs?: Switch_VersionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Switch_VersionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Switch_VersionInputs = {};
