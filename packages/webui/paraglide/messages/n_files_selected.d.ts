/**
* | output |
* | --- |
* | "{count} file(s) selected" |
*
* @param {N_Files_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_files_selected: ((inputs: N_Files_SelectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Files_SelectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Files_SelectedInputs = {
    count: NonNullable<unknown>;
};
