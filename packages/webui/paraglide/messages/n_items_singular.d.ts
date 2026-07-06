/**
* | output |
* | --- |
* | "{count} Item" |
*
* @param {N_Items_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_items_singular: ((inputs: N_Items_SingularInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Items_SingularInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Items_SingularInputs = {
    count: NonNullable<unknown>;
};
