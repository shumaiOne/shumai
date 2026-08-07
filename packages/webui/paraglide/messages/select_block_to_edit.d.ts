/**
* | output |
* | --- |
* | "Select a block to edit its properties" |
*
* @param {Select_Block_To_EditInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_block_to_edit: ((inputs?: Select_Block_To_EditInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Select_Block_To_EditInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Select_Block_To_EditInputs = {};
