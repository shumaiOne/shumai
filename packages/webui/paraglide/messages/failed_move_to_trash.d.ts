/**
* | output |
* | --- |
* | "Failed to move to trash" |
*
* @param {Failed_Move_To_TrashInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_move_to_trash: ((inputs?: Failed_Move_To_TrashInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_Move_To_TrashInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_Move_To_TrashInputs = {};
