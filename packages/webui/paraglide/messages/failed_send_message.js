/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Send_MessageInputs */

const en_failed_send_message = /** @type {(inputs: Failed_Send_MessageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to send message`)
};

const zh_failed_send_message = /** @type {(inputs: Failed_Send_MessageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`发送消息失败`)
};

/**
* | output |
* | --- |
* | "Failed to send message" |
*
* @param {Failed_Send_MessageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_send_message = /** @type {((inputs?: Failed_Send_MessageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Send_MessageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_send_message(inputs)
	return zh_failed_send_message(inputs)
});