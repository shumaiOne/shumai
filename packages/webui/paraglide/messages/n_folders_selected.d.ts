/**
* | output |
* | --- |
* | "{count} folder(s) selected" |
*
* @param {N_Folders_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_folders_selected: ((inputs: N_Folders_SelectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Folders_SelectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Folders_SelectedInputs = {
    count: NonNullable<unknown>;
};
