/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ creator: NonNullable<unknown>, asset: NonNullable<unknown> }} Notification_Mentioned_YouInputs */

const en_notification_mentioned_you = /** @type {(inputs: Notification_Mentioned_YouInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} mentioned you in ${i?.asset}`)
};

const zh_notification_mentioned_you = /** @type {(inputs: Notification_Mentioned_YouInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.creator} 在 ${i?.asset} 中提及了你`)
};

/**
* | output |
* | --- |
* | "{creator} mentioned you in {asset}" |
*
* @param {Notification_Mentioned_YouInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const notification_mentioned_you = /** @type {((inputs: Notification_Mentioned_YouInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Notification_Mentioned_YouInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_notification_mentioned_you(inputs)
	return zh_notification_mentioned_you(inputs)
});