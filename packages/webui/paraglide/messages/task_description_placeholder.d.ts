/**
* | output |
* | --- |
* | "Add details, acceptance criteria, or context..." |
*
* @param {Task_Description_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_description_placeholder: ((inputs?: Task_Description_PlaceholderInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_Description_PlaceholderInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_Description_PlaceholderInputs = {};
