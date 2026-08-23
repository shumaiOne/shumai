/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Priority_UrgentInputs */

const en_priority_urgent = /** @type {(inputs: Priority_UrgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Urgent`)
};

const zh_priority_urgent = /** @type {(inputs: Priority_UrgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`紧急`)
};

/**
* | output |
* | --- |
* | "Urgent" |
*
* @param {Priority_UrgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const priority_urgent = /** @type {((inputs?: Priority_UrgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Priority_UrgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_priority_urgent(inputs)
	return zh_priority_urgent(inputs)
});