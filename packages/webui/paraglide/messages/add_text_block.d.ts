/**
* | output |
* | --- |
* | "Add Text Block" |
*
* @param {Add_Text_BlockInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_text_block: ((inputs?: Add_Text_BlockInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Text_BlockInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Text_BlockInputs = {};
