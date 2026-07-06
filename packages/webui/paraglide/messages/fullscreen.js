/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FullscreenInputs */

const en_fullscreen = /** @type {(inputs: FullscreenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fullscreen`)
};

const zh_fullscreen = /** @type {(inputs: FullscreenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`全屏`)
};

/**
* | output |
* | --- |
* | "Fullscreen" |
*
* @param {FullscreenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const fullscreen = /** @type {((inputs?: FullscreenInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FullscreenInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_fullscreen(inputs)
	return zh_fullscreen(inputs)
});