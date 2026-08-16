/**
* | output |
* | --- |
* | "Quota rule deleted successfully" |
*
* @param {Quota_Deleted_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_deleted_successfully: ((inputs?: Quota_Deleted_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Deleted_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Deleted_SuccessfullyInputs = {};
