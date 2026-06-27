/**
* | output |
* | --- |
* | "Sorted by {field}" |
*
* @param {Sorted_ByInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sorted_by: ((inputs: Sorted_ByInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sorted_ByInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sorted_ByInputs = {
    field: NonNullable<unknown>;
};
