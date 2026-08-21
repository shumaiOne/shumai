/**
* | output |
* | --- |
* | "Search tasks in this status..." |
*
* @param {Filter_Tasks_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filter_tasks_placeholder: ((inputs?: Filter_Tasks_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Filter_Tasks_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Filter_Tasks_PlaceholderInputs = {};
