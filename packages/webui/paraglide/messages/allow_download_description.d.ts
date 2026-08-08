/**
* | output |
* | --- |
* | "Visitors can download files from this share link" |
*
* @param {Allow_Download_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const allow_download_description: ((inputs?: Allow_Download_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Allow_Download_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Allow_Download_DescriptionInputs = {};
