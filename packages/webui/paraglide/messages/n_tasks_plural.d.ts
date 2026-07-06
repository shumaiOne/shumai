/**
* | output |
* | --- |
* | "{count} tasks" |
*
* @param {N_Tasks_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_tasks_plural: ((inputs: N_Tasks_PluralInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Tasks_PluralInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Tasks_PluralInputs = {
    count: NonNullable<unknown>;
};
