/**
* | output |
* | --- |
* | "Download original image" |
*
* @param {Download_Original_ImageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const download_original_image: ((inputs?: Download_Original_ImageInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Download_Original_ImageInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Download_Original_ImageInputs = {};
