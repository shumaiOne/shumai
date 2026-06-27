/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Permanently_DeletedInputs */

const en_permanently_deleted = /** @type {(inputs: Permanently_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Permanently deleted`)
};

const zh_permanently_deleted = /** @type {(inputs: Permanently_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已永久删除`)
};

/**
* | output |
* | --- |
* | "Permanently deleted" |
*
* @param {Permanently_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const permanently_deleted = /** @type {((inputs?: Permanently_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Permanently_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_permanently_deleted(inputs)
	return zh_permanently_deleted(inputs)
});