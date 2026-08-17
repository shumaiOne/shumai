/**
* | output |
* | --- |
* | "Quota status updated" |
*
* @param {Quota_Status_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_status_updated: ((inputs?: Quota_Status_UpdatedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Status_UpdatedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Status_UpdatedInputs = {};
