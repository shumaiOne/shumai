/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Recently_DeletedInputs */

const en_recently_deleted = /** @type {(inputs: Recently_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Recently Deleted`)
};

const zh_recently_deleted = /** @type {(inputs: Recently_DeletedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`最近删除`)
};

/**
* | output |
* | --- |
* | "Recently Deleted" |
*
* @param {Recently_DeletedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const recently_deleted = /** @type {((inputs?: Recently_DeletedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Recently_DeletedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_recently_deleted(inputs)
	return zh_recently_deleted(inputs)
});