/**
* | output |
* | --- |
* | "Resource Quotas" |
*
* @param {Resource_QuotasInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const resource_quotas: ((inputs?: Resource_QuotasInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Resource_QuotasInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Resource_QuotasInputs = {};
