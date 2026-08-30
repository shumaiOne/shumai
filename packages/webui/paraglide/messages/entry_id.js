/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Entry_IdInputs */

const en_entry_id = /** @type {(inputs: Entry_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Entry ID`)
};

const zh_entry_id = /** @type {(inputs: Entry_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`条目 ID`)
};

/**
* | output |
* | --- |
* | "Entry ID" |
*
* @param {Entry_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const entry_id = /** @type {((inputs?: Entry_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Entry_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_entry_id(inputs)
	return zh_entry_id(inputs)
});