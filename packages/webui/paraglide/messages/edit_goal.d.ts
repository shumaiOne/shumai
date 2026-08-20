/**
* | output |
* | --- |
* | "Edit Goal" |
*
* @param {Edit_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const edit_goal: ((inputs?: Edit_GoalInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Edit_GoalInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Edit_GoalInputs = {};
