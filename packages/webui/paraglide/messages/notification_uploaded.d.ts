/**
* | output |
* | --- |
* | "{creator} uploaded {asset} to {project}" |
*
* @param {Notification_UploadedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_uploaded: ((inputs: Notification_UploadedInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_UploadedInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_UploadedInputs = {
    creator: NonNullable<unknown>;
    asset: NonNullable<unknown>;
    project: NonNullable<unknown>;
};
