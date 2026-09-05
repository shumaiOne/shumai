/**
* | output |
* | --- |
* | "Video" |
*
* @param {Media_Type_VideoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const media_type_video: ((inputs?: Media_Type_VideoInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Media_Type_VideoInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Media_Type_VideoInputs = {};
