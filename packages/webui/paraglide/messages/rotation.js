/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} RotationInputs */

const en_rotation = /** @type {(inputs: RotationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Rotation`)
};

const zh_rotation = /** @type {(inputs: RotationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`旋转角度`)
};

/**
* | output |
* | --- |
* | "Rotation" |
*
* @param {RotationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const rotation = /** @type {((inputs?: RotationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<RotationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_rotation(inputs)
	return zh_rotation(inputs)
});