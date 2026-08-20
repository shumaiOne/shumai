/**
* | output |
* | --- |
* | "Dependency added" |
*
* @param {Dependency_AddedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dependency_added: ((inputs?: Dependency_AddedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Dependency_AddedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Dependency_AddedInputs = {};
