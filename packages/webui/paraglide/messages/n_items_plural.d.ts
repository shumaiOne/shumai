/**
* | output |
* | --- |
* | "{count} Items" |
*
* @param {N_Items_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_items_plural: ((inputs: N_Items_PluralInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Items_PluralInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Items_PluralInputs = {
    count: NonNullable<unknown>;
};
