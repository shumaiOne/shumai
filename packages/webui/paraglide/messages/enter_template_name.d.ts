/**
* | output |
* | --- |
* | "Enter template name..." |
*
* @param {Enter_Template_NameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enter_template_name: ((inputs?: Enter_Template_NameInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Enter_Template_NameInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Enter_Template_NameInputs = {};
