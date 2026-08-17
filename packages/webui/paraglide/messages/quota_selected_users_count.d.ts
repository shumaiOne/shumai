/**
* | output |
* | --- |
* | "{count} members selected" |
*
* @param {Quota_Selected_Users_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_selected_users_count: ((inputs: Quota_Selected_Users_CountInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Quota_Selected_Users_CountInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Quota_Selected_Users_CountInputs = {
    count: NonNullable<unknown>;
};
