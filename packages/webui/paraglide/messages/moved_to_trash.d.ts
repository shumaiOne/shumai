/**
* | output |
* | --- |
* | "Moved to trash" |
*
* @param {Moved_To_TrashInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const moved_to_trash: ((inputs?: Moved_To_TrashInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Moved_To_TrashInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Moved_To_TrashInputs = {};
