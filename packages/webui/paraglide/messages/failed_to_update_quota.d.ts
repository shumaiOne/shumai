/**
* | output |
* | --- |
* | "Failed to update quota rule" |
*
* @param {Failed_To_Update_QuotaInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_update_quota: ((inputs?: Failed_To_Update_QuotaInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Update_QuotaInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Update_QuotaInputs = {};
