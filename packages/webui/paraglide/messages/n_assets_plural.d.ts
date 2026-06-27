/**
* | output |
* | --- |
* | "{count} Assets" |
*
* @param {N_Assets_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_assets_plural: ((inputs: N_Assets_PluralInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Assets_PluralInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Assets_PluralInputs = {
    count: NonNullable<unknown>;
};
