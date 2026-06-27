/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Save_ChangesInputs */

const en_save_changes = /** @type {(inputs: Save_ChangesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Save Changes`)
};

const zh_save_changes = /** @type {(inputs: Save_ChangesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`保存更改`)
};

/**
* | output |
* | --- |
* | "Save Changes" |
*
* @param {Save_ChangesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const save_changes = /** @type {((inputs?: Save_ChangesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Save_ChangesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_save_changes(inputs)
	return zh_save_changes(inputs)
});