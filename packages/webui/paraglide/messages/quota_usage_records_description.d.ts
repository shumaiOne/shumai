/**
* | output |
* | --- |
* | "Real-time usage breakdown for this quota rule." |
*
* @param {Quota_Usage_Records_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_usage_records_description: ((inputs?: Quota_Usage_Records_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Usage_Records_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Usage_Records_DescriptionInputs = {};
