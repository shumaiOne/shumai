/**
* | output |
* | --- |
* | "{count} Folder" |
*
* @param {N_Folders_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_folders_singular: ((inputs: N_Folders_SingularInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Folders_SingularInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Folders_SingularInputs = {
    count: NonNullable<unknown>;
};
