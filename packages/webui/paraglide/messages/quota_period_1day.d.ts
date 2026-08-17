/**
* | output |
* | --- |
* | "1 Day" |
*
* @param {Quota_Period_1dayInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_period_1day: ((inputs?: Quota_Period_1dayInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Period_1dayInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Period_1dayInputs = {};
