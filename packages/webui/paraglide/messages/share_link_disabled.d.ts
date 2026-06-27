/**
* | output |
* | --- |
* | "This share link is disabled" |
*
* @param {Share_Link_DisabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link_disabled: ((inputs?: Share_Link_DisabledInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Share_Link_DisabledInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Share_Link_DisabledInputs = {};
