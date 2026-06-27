/**
* | output |
* | --- |
* | "Invite New Member" |
*
* @param {Invite_New_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invite_new_member: ((inputs?: Invite_New_MemberInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Invite_New_MemberInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Invite_New_MemberInputs = {};
