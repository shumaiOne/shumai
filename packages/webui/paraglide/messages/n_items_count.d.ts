/**
* | output |
* | --- |
* | "{count} Item(s)" |
*
* @param {N_Items_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_items_count: ((inputs: N_Items_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Items_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Items_CountInputs = {
    count: NonNullable<unknown>;
};
