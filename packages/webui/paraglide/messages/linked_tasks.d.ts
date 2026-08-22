/**
* | output |
* | --- |
* | "Linked Tasks" |
*
* @param {Linked_TasksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const linked_tasks: ((inputs?: Linked_TasksInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Linked_TasksInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Linked_TasksInputs = {};
