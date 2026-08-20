/**
* | output |
* | --- |
* | "Create your first goal to organize related tasks." |
*
* @param {Create_First_GoalInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_first_goal: ((inputs?: Create_First_GoalInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Create_First_GoalInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Create_First_GoalInputs = {};
