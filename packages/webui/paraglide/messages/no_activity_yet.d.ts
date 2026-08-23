/**
* | output |
* | --- |
* | "No activity recorded yet" |
*
* @param {No_Activity_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_activity_yet: ((inputs?: No_Activity_YetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Activity_YetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Activity_YetInputs = {};
