/**
* | output |
* | --- |
* | "{count} files" |
*
* @param {N_Files_PluralInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_files_plural: ((inputs: N_Files_PluralInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Files_PluralInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Files_PluralInputs = {
    count: NonNullable<unknown>;
};
