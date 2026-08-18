/**
* | output |
* | --- |
* | "Quota usage reset successfully" |
*
* @param {Quota_Reset_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_reset_successfully: ((inputs?: Quota_Reset_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Reset_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Reset_SuccessfullyInputs = {};
