/**
* | output |
* | --- |
* | "{count} file" |
*
* @param {N_Files_SingularInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const n_files_singular: ((inputs: N_Files_SingularInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<N_Files_SingularInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type N_Files_SingularInputs = {
    count: NonNullable<unknown>;
};
