/**
* | output |
* | --- |
* | "This page displays the 100 most recent files you viewed in this project." |
*
* @param {Recents_Toolbar_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const recents_toolbar_hint: ((inputs?: Recents_Toolbar_HintInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Recents_Toolbar_HintInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Recents_Toolbar_HintInputs = {};
