/**
* | output |
* | --- |
* | "Output Cost (1M)" |
*
* @param {Output_Cost_1mInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const output_cost_1m: ((inputs?: Output_Cost_1mInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Output_Cost_1mInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Output_Cost_1mInputs = {};
