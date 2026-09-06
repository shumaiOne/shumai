/**
* | output |
* | --- |
* | "Image / Video Generation" |
*
* @param {Image_Video_GenerationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const image_video_generation: ((inputs?: Image_Video_GenerationInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Image_Video_GenerationInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Image_Video_GenerationInputs = {};
