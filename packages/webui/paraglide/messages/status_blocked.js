/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Status_BlockedInputs */

const en_status_blocked = /** @type {(inputs: Status_BlockedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Blocked`)
};

const zh_status_blocked = /** @type {(inputs: Status_BlockedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已受阻`)
};

/**
* | output |
* | --- |
* | "Blocked" |
*
* @param {Status_BlockedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_blocked = /** @type {((inputs?: Status_BlockedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Status_BlockedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_status_blocked(inputs)
	return zh_status_blocked(inputs)
});