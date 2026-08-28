/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TimecodeInputs */

const en_timecode = /** @type {(inputs: TimecodeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Timecode`)
};

const zh_timecode = /** @type {(inputs: TimecodeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`时间码`)
};

/**
* | output |
* | --- |
* | "Timecode" |
*
* @param {TimecodeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const timecode = /** @type {((inputs?: TimecodeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TimecodeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_timecode(inputs)
	return zh_timecode(inputs)
});