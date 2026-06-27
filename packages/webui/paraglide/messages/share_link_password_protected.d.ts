/**
* | output |
* | --- |
* | "This share link is password protected." |
*
* @param {Share_Link_Password_ProtectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link_password_protected: ((inputs?: Share_Link_Password_ProtectedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Share_Link_Password_ProtectedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Share_Link_Password_ProtectedInputs = {};
