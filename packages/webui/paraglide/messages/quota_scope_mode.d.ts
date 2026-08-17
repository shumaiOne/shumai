/**
* | output |
* | --- |
* | "Target Mode" |
*
* @param {Quota_Scope_ModeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_scope_mode: ((inputs?: Quota_Scope_ModeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Scope_ModeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Scope_ModeInputs = {};
