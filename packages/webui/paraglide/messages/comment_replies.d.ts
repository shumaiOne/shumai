/**
* | output |
* | --- |
* | "Comment Replies" |
*
* @param {Comment_RepliesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const comment_replies: ((inputs?: Comment_RepliesInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Comment_RepliesInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Comment_RepliesInputs = {};
