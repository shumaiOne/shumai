/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} RestoreInputs */

const en_restore = /** @type {(inputs: RestoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Restore`)
};

const zh_restore = /** @type {(inputs: RestoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`恢复`)
};

/**
* | output |
* | --- |
* | "Restore" |
*
* @param {RestoreInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const restore = /** @type {((inputs?: RestoreInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<RestoreInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_restore(inputs)
	return zh_restore(inputs)
});