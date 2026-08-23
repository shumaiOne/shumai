/**
* | output |
* | --- |
* | "Cannot select this task as it would create a circular dependency" |
*
* @param {Circular_Dependency_WarningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const circular_dependency_warning: ((inputs?: Circular_Dependency_WarningInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Circular_Dependency_WarningInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Circular_Dependency_WarningInputs = {};
