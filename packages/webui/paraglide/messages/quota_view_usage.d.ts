/**
* | output |
* | --- |
* | "View Usage" |
*
* @param {Quota_View_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_view_usage: ((inputs?: Quota_View_UsageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_View_UsageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_View_UsageInputs = {};
