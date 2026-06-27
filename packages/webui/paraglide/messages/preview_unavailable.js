/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Preview_UnavailableInputs */

const en_preview_unavailable = /** @type {(inputs: Preview_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Preview unavailable`)
};

const zh_preview_unavailable = /** @type {(inputs: Preview_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`无法预览`)
};

/**
* | output |
* | --- |
* | "Preview unavailable" |
*
* @param {Preview_UnavailableInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const preview_unavailable = /** @type {((inputs?: Preview_UnavailableInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Preview_UnavailableInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_preview_unavailable(inputs)
	return zh_preview_unavailable(inputs)
});