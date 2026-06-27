/**
* | output |
* | --- |
* | "{count} Asset" |
*
* @param {N_Assets_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_assets_singular: ((inputs: N_Assets_SingularInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Assets_SingularInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Assets_SingularInputs = {
    count: NonNullable<unknown>;
};
