/**
* | output |
* | --- |
* | "${input}/1M in · ${output}/1M out" |
*
* @param {Cost_Per_MillionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const cost_per_million: ((inputs: Cost_Per_MillionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Cost_Per_MillionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Cost_Per_MillionInputs = {
    input: NonNullable<unknown>;
    output: NonNullable<unknown>;
};
