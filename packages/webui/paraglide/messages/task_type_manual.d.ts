/**
* | output |
* | --- |
* | "Human Task" |
*
* @param {Task_Type_ManualInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_type_manual: ((inputs?: Task_Type_ManualInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_Type_ManualInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_Type_ManualInputs = {};
