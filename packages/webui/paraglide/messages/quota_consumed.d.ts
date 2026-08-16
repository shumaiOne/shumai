/**
* | output |
* | --- |
* | "Consumed" |
*
* @param {Quota_ConsumedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_consumed: ((inputs?: Quota_ConsumedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_ConsumedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_ConsumedInputs = {};
