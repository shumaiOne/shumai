/**
* | output |
* | --- |
* | "Select Actions" |
*
* @param {Select_ActionsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_actions: ((inputs?: Select_ActionsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_ActionsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_ActionsInputs = {};
