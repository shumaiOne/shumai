/**
* | output |
* | --- |
* | "Resets in" |
*
* @param {Quota_Period_ResetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_resets: ((inputs?: Quota_Period_ResetsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Period_ResetsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Period_ResetsInputs = {};
