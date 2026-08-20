/**
* | output |
* | --- |
* | "Goal deleted" |
*
* @param {Goal_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const goal_deleted: ((inputs?: Goal_DeletedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Goal_DeletedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Goal_DeletedInputs = {};
