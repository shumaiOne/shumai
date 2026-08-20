/**
* | output |
* | --- |
* | "Are you sure you want to delete goal \"{title}\"? Associated tasks will remain but will no longer be linked to this goal." |
*
* @param {Delete_Goal_ConfirmInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const delete_goal_confirm: ((inputs: Delete_Goal_ConfirmInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Delete_Goal_ConfirmInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Delete_Goal_ConfirmInputs = {
    title: NonNullable<unknown>;
};
