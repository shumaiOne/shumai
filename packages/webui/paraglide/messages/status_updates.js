/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Status_UpdatesInputs */

const en_status_updates = /** @type {(inputs: Status_UpdatesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Status Updates`)
};

const zh_status_updates = /** @type {(inputs: Status_UpdatesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`状态更新`)
};

/**
* | output |
* | --- |
* | "Status Updates" |
*
* @param {Status_UpdatesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_updates = /** @type {((inputs?: Status_UpdatesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Status_UpdatesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_status_updates(inputs)
	return zh_status_updates(inputs)
});