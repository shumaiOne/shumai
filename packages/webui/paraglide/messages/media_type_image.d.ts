/**
* | output |
* | --- |
* | "Image" |
*
* @param {Media_Type_ImageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_type_image: ((inputs?: Media_Type_ImageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Media_Type_ImageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Media_Type_ImageInputs = {};
