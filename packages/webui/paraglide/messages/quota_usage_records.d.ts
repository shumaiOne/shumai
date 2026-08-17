/**
* | output |
* | --- |
* | "Usage Records" |
*
* @param {Quota_Usage_RecordsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_usage_records: ((inputs?: Quota_Usage_RecordsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Usage_RecordsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Usage_RecordsInputs = {};
