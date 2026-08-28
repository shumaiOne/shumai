/**
* | output |
* | --- |
* | "Failed to post comment" |
*
* @param {Failed_To_Post_CommentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_post_comment: ((inputs?: Failed_To_Post_CommentInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Failed_To_Post_CommentInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Failed_To_Post_CommentInputs = {};
