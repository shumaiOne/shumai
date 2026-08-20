/**
* | output |
* | --- |
* | "Select Assignee" |
*
* @param {Select_AssigneeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_assignee: ((inputs?: Select_AssigneeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_AssigneeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_AssigneeInputs = {};
