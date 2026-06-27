/**
* | output |
* | --- |
* | "Hide Right Sidebar" |
*
* @param {Hide_Right_SidebarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hide_right_sidebar: ((inputs?: Hide_Right_SidebarInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Hide_Right_SidebarInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Hide_Right_SidebarInputs = {};
