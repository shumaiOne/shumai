/**
* | output |
* | --- |
* | "e.g. Q3 Launch Deliverables" |
*
* @param {Goal_Title_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_title_placeholder: ((inputs?: Goal_Title_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Goal_Title_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Goal_Title_PlaceholderInputs = {};
