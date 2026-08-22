/**
* | output |
* | --- |
* | "{count} assets selected" |
*
* @param {N_Assets_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_assets_selected: ((inputs: N_Assets_SelectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Assets_SelectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Assets_SelectedInputs = {
    count: NonNullable<unknown>;
};
