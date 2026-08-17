/**
* | output |
* | --- |
* | "e.g. 100000" |
*
* @param {Quota_Limit_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_limit_placeholder: ((inputs?: Quota_Limit_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Limit_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Limit_PlaceholderInputs = {};
