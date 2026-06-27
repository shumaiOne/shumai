/**
* | output |
* | --- |
* | "Invite link copied to clipboard" |
*
* @param {Invite_Link_CopiedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invite_link_copied: ((inputs?: Invite_Link_CopiedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Invite_Link_CopiedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Invite_Link_CopiedInputs = {};
