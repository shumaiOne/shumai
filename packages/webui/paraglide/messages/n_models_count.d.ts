/**
* | output |
* | --- |
* | "{count} Models" |
*
* @param {N_Models_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_models_count: ((inputs: N_Models_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Models_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Models_CountInputs = {
    count: NonNullable<unknown>;
};
