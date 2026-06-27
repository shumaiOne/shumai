/**
* | output |
* | --- |
* | "You will be the owner of the default workspace as the first user!" |
*
* @param {First_User_NoticeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const first_user_notice: ((inputs?: First_User_NoticeInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<First_User_NoticeInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type First_User_NoticeInputs = {};
