/**
* | output |
* | --- |
* | "Are you sure you want to delete this quota rule? This action cannot be undone." |
*
* @param {Delete_Quota_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_quota_confirm: ((inputs?: Delete_Quota_ConfirmInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Quota_ConfirmInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Quota_ConfirmInputs = {};
