/**
* | output |
* | --- |
* | "1 Hour" |
*
* @param {Quota_Period_1hourInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_1hour: ((inputs?: Quota_Period_1hourInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Period_1hourInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Period_1hourInputs = {};
