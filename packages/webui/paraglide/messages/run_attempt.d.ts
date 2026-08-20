/**
* | output |
* | --- |
* | "Attempt #{number}" |
*
* @param {Run_AttemptInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_attempt: ((inputs: Run_AttemptInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Run_AttemptInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Run_AttemptInputs = {
    number: NonNullable<unknown>;
};
