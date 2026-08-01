/**
* | output |
* | --- |
* | "Team" |
*
* @param {Team_CategoryInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team_category: ((inputs?: Team_CategoryInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Team_CategoryInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Team_CategoryInputs = {};
