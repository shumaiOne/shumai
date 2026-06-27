/**
* | output |
* | --- |
* | "Please provide your name and email to add a comment." |
*
* @param {Provide_Name_Email_For_CommentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const provide_name_email_for_comment: ((inputs?: Provide_Name_Email_For_CommentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Provide_Name_Email_For_CommentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Provide_Name_Email_For_CommentInputs = {};
