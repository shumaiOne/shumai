/**
* | output |
* | --- |
* | "{count} Items" |
*
* @param {N_ItemsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_items: ((inputs: N_ItemsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_ItemsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_ItemsInputs = {
    count: NonNullable<unknown>;
};
