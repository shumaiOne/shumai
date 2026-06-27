/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} DeletedInputs */

const en_deleted = /** @type {(inputs: DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deleted`)
};

const zh_deleted = /** @type {(inputs: DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已删除`)
};

/**
* | output |
* | --- |
* | "Deleted" |
*
* @param {DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const deleted = /** @type {((inputs?: DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deleted(inputs)
	return zh_deleted(inputs)
});