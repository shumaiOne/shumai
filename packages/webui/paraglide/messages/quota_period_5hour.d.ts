/**
* | output |
* | --- |
* | "5 Hours" |
*
* @param {Quota_Period_5hourInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_5hour: ((inputs?: Quota_Period_5hourInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Period_5hourInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Period_5hourInputs = {};
