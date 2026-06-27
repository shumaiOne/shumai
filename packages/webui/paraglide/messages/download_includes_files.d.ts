/**
* | output |
* | --- |
* | "This download will include {count} file(s)." |
*
* @param {Download_Includes_FilesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const download_includes_files: ((inputs: Download_Includes_FilesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Download_Includes_FilesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Download_Includes_FilesInputs = {
    count: NonNullable<unknown>;
};
