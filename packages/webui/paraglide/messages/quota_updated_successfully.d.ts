/**
* | output |
* | --- |
* | "Quota rule updated successfully" |
*
* @param {Quota_Updated_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_updated_successfully: ((inputs?: Quota_Updated_SuccessfullyInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Updated_SuccessfullyInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Updated_SuccessfullyInputs = {};
