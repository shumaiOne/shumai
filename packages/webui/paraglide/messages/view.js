/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ViewInputs */

const en_view = /** @type {(inputs: ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`View`)
};

const zh_view = /** @type {(inputs: ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`查看`)
};

/**
* | output |
* | --- |
* | "View" |
*
* @param {ViewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const view = /** @type {((inputs?: ViewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ViewInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_view(inputs)
	return zh_view(inputs)
});