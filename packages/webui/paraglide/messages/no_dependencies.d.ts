/**
* | output |
* | --- |
* | "No dependencies" |
*
* @param {No_DependenciesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_dependencies: ((inputs?: No_DependenciesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<No_DependenciesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type No_DependenciesInputs = {};
