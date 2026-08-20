/**
* | output |
* | --- |
* | "Ended {time}" |
*
* @param {Run_Ended_AtInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_ended_at: ((inputs: Run_Ended_AtInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Run_Ended_AtInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Run_Ended_AtInputs = {
    time: NonNullable<unknown>;
};
