/**
* | output |
* | --- |
* | "Copy name and path" |
*
* @param {Copy_Name_And_PathInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const copy_name_and_path: ((inputs?: Copy_Name_And_PathInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Copy_Name_And_PathInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Copy_Name_And_PathInputs = {};
