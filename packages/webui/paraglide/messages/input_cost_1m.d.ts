/**
* | output |
* | --- |
* | "Input Cost (1M)" |
*
* @param {Input_Cost_1mInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const input_cost_1m: ((inputs?: Input_Cost_1mInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Input_Cost_1mInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Input_Cost_1mInputs = {};
