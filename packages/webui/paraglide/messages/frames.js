/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} FramesInputs */

const en_frames = /** @type {(inputs: FramesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Frames`)
};

const zh_frames = /** @type {(inputs: FramesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`帧数`)
};

/**
* | output |
* | --- |
* | "Frames" |
*
* @param {FramesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const frames = /** @type {((inputs?: FramesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<FramesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_frames(inputs)
	return zh_frames(inputs)
});