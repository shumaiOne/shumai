/**
* | output |
* | --- |
* | "Select task to link..." |
*
* @param {Select_Task_To_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_task_to_link: ((inputs?: Select_Task_To_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Task_To_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Task_To_LinkInputs = {};
