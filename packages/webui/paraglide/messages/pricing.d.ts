/**
* | output |
* | --- |
* | "Pricing ($ per 1M tokens)" |
*
* @param {PricingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const pricing: ((inputs?: PricingInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<PricingInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type PricingInputs = {};
