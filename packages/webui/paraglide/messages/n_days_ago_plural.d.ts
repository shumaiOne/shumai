/**
* | output |
* | --- |
* | "{count} days ago" |
*
* @param {N_Days_Ago_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_days_ago_plural: ((inputs: N_Days_Ago_PluralInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Days_Ago_PluralInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Days_Ago_PluralInputs = {
    count: NonNullable<unknown>;
};
