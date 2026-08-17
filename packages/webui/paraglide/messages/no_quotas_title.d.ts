/**
* | output |
* | --- |
* | "No resource quotas configured" |
*
* @param {No_Quotas_TitleInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_quotas_title: ((inputs?: No_Quotas_TitleInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Quotas_TitleInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Quotas_TitleInputs = {};
