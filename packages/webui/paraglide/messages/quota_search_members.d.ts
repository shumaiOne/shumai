/**
* | output |
* | --- |
* | "Search members..." |
*
* @param {Quota_Search_MembersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_search_members: ((inputs?: Quota_Search_MembersInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Search_MembersInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Search_MembersInputs = {};
