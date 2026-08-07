/**
* | output |
* | --- |
* | "Add Image Block" |
*
* @param {Add_Image_BlockInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_image_block: ((inputs?: Add_Image_BlockInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Add_Image_BlockInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Add_Image_BlockInputs = {};
