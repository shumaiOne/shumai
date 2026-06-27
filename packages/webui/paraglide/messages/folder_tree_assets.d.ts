/**
* | output |
* | --- |
* | "Assets" |
*
* @param {Folder_Tree_AssetsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const folder_tree_assets: ((inputs?: Folder_Tree_AssetsInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Folder_Tree_AssetsInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Folder_Tree_AssetsInputs = {};
