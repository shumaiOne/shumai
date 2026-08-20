/**
* | output |
* | --- |
* | "Create Goal" |
*
* @param {Create_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_goal: ((inputs?: Create_GoalInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Create_GoalInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Create_GoalInputs = {};
