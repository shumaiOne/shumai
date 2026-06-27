/**
* | output |
* | --- |
* | "{creator} replied to a comment on {asset}" |
*
* @param {Notification_Replied_ToInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_replied_to: ((inputs: Notification_Replied_ToInputs, options?: {
    locale?: "en" | "zh";
}) => LocalizedString) & import("../runtime.js").MessageMetadata<Notification_Replied_ToInputs, {
    locale?: "en" | "zh";
}, {}>;
export type LocalizedString = import("../runtime.js").LocalizedString;
export type Notification_Replied_ToInputs = {
    creator: NonNullable<unknown>;
    asset: NonNullable<unknown>;
};
