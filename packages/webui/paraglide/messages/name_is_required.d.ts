/**
* | output |
* | --- |
* | "Name is required" |
*
* @param {Name_Is_RequiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const name_is_required: ((inputs?: Name_Is_RequiredInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Name_Is_RequiredInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Name_Is_RequiredInputs = {};
