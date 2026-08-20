/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Status_In_ProgressInputs */

const en_status_in_progress = /** @type {(inputs: Status_In_ProgressInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`In Progress`)
};

const zh_status_in_progress = /** @type {(inputs: Status_In_ProgressInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`进行中`)
};

/**
* | output |
* | --- |
* | "In Progress" |
*
* @param {Status_In_ProgressInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const status_in_progress = /** @type {((inputs?: Status_In_ProgressInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Status_In_ProgressInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_status_in_progress(inputs)
	return zh_status_in_progress(inputs)
});