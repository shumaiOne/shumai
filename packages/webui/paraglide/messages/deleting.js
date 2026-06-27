/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DeletingInputs */

const en_deleting = /** @type {(inputs: DeletingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deleting...`)
};

const zh_deleting = /** @type {(inputs: DeletingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除中...`)
};

/**
* | output |
* | --- |
* | "Deleting..." |
*
* @param {DeletingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const deleting = /** @type {((inputs?: DeletingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DeletingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deleting(inputs)
	return zh_deleting(inputs)
});