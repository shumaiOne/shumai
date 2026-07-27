/**
* | output |
* | --- |
* | "Copy name and download link" |
*
* @param {Copy_Name_And_Download_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copy_name_and_download_link: ((inputs?: Copy_Name_And_Download_LinkInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Copy_Name_And_Download_LinkInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Copy_Name_And_Download_LinkInputs = {};
