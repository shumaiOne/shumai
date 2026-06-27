/**
* | output |
* | --- |
* | "Manage your team's media transcoding configurations." |
*
* @param {Transcode_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const transcode_description: ((inputs?: Transcode_DescriptionInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Transcode_DescriptionInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Transcode_DescriptionInputs = {};
