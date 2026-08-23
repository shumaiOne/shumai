/**
* | output |
* | --- |
* | "Blocked By (Prerequisites)" |
*
* @param {Blocked_ByInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const blocked_by: ((inputs?: Blocked_ByInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Blocked_ByInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Blocked_ByInputs = {};
