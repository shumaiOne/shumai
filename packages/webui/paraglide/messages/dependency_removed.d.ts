/**
* | output |
* | --- |
* | "Dependency removed" |
*
* @param {Dependency_RemovedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dependency_removed: ((inputs?: Dependency_RemovedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Dependency_RemovedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Dependency_RemovedInputs = {};
