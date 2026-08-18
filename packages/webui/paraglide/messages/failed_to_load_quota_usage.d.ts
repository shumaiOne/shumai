/**
* | output |
* | --- |
* | "Failed to load quota usage" |
*
* @param {Failed_To_Load_Quota_UsageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_load_quota_usage: ((inputs?: Failed_To_Load_Quota_UsageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Load_Quota_UsageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Load_Quota_UsageInputs = {};
