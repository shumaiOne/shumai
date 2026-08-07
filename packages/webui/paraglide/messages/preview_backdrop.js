/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Preview_BackdropInputs */

const en_preview_backdrop = /** @type {(inputs: Preview_BackdropInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Preview Background`)
};

const zh_preview_backdrop = /** @type {(inputs: Preview_BackdropInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`预览背景`)
};

/**
* | output |
* | --- |
* | "Preview Background" |
*
* @param {Preview_BackdropInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const preview_backdrop = /** @type {((inputs?: Preview_BackdropInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Preview_BackdropInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_preview_backdrop(inputs)
	return zh_preview_backdrop(inputs)
});