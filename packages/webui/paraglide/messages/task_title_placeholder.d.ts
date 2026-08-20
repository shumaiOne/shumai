/**
* | output |
* | --- |
* | "What needs to be done?" |
*
* @param {Task_Title_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_title_placeholder: ((inputs?: Task_Title_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_Title_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_Title_PlaceholderInputs = {};
