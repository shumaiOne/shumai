/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} RenameInputs */

const en_rename = /** @type {(inputs: RenameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Rename`)
};

const zh_rename = /** @type {(inputs: RenameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重命名`)
};

/**
* | output |
* | --- |
* | "Rename" |
*
* @param {RenameInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const rename = /** @type {((inputs?: RenameInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<RenameInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_rename(inputs)
	return zh_rename(inputs)
});