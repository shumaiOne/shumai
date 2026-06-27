/**
* | output |
* | --- |
* | "Filesystem Restriction" |
*
* @param {Filesystem_RestrictionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const filesystem_restriction: ((inputs?: Filesystem_RestrictionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Filesystem_RestrictionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Filesystem_RestrictionInputs = {};
