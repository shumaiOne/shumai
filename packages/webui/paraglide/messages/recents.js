/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} RecentsInputs */

const en_recents = /** @type {(inputs: RecentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recents`)
};

const zh_recents = /** @type {(inputs: RecentsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`最近`)
};

/**
* | output |
* | --- |
* | "Recents" |
*
* @param {RecentsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const recents = /** @type {((inputs?: RecentsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<RecentsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recents(inputs)
	return zh_recents(inputs)
});