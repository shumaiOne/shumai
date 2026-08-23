/**
* | output |
* | --- |
* | "Search tasks to link..." |
*
* @param {Search_Tasks_To_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const search_tasks_to_link: ((inputs?: Search_Tasks_To_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Search_Tasks_To_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Search_Tasks_To_LinkInputs = {};
