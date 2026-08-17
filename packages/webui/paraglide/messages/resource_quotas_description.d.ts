/**
* | output |
* | --- |
* | "Manage and limit resource usage across team members, roles, and AI operations." |
*
* @param {Resource_Quotas_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const resource_quotas_description: ((inputs?: Resource_Quotas_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Resource_Quotas_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Resource_Quotas_DescriptionInputs = {};
