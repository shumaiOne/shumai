/**
* | output |
* | --- |
* | "{count} day ago" |
*
* @param {N_Days_Ago_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_days_ago_singular: ((inputs: N_Days_Ago_SingularInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Days_Ago_SingularInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Days_Ago_SingularInputs = {
    count: NonNullable<unknown>;
};
