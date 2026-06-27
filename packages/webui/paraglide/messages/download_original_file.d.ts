/**
* | output |
* | --- |
* | "Download original file" |
*
* @param {Download_Original_FileInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const download_original_file: ((inputs?: Download_Original_FileInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Download_Original_FileInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Download_Original_FileInputs = {};
