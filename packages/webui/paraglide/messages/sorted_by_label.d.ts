/**
* | output |
* | --- |
* | "Sorted by" |
*
* @param {Sorted_By_LabelInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sorted_by_label: ((inputs?: Sorted_By_LabelInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Sorted_By_LabelInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Sorted_By_LabelInputs = {};
