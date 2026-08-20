/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Status_CancelledInputs */

const en_status_cancelled = /** @type {(inputs: Status_CancelledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cancelled`)
};

const zh_status_cancelled = /** @type {(inputs: Status_CancelledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已取消`)
};

/**
* | output |
* | --- |
* | "Cancelled" |
*
* @param {Status_CancelledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_cancelled = /** @type {((inputs?: Status_CancelledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Status_CancelledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_status_cancelled(inputs)
	return zh_status_cancelled(inputs)
});