/**
* | output |
* | --- |
* | "No goals yet" |
*
* @param {No_Goals_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_goals_yet: ((inputs?: No_Goals_YetInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_Goals_YetInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_Goals_YetInputs = {};
