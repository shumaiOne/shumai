/**
* | output |
* | --- |
* | "Task cannot be moved because prerequisite dependencies are not done" |
*
* @param {Task_Has_Unmet_DependenciesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const task_has_unmet_dependencies: ((inputs?: Task_Has_Unmet_DependenciesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Task_Has_Unmet_DependenciesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Task_Has_Unmet_DependenciesInputs = {};
