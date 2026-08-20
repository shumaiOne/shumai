/**
* | output |
* | --- |
* | "Started {time}" |
*
* @param {Run_Started_AtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_started_at: ((inputs: Run_Started_AtInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Run_Started_AtInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Run_Started_AtInputs = {
    time: NonNullable<unknown>;
};
