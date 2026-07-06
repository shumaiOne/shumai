/**
* | output |
* | --- |
* | "{uploaded} / {total} files" |
*
* @param {Files_ProgressInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const files_progress: ((inputs: Files_ProgressInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Files_ProgressInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Files_ProgressInputs = {
    uploaded: NonNullable<unknown>;
    total: NonNullable<unknown>;
};
