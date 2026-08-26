/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hardware_AccelerationInputs */

const en_hardware_acceleration = /** @type {(inputs: Hardware_AccelerationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hardware Acceleration`)
};

const zh_hardware_acceleration = /** @type {(inputs: Hardware_AccelerationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`硬件加速`)
};

/**
* | output |
* | --- |
* | "Hardware Acceleration" |
*
* @param {Hardware_AccelerationInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration = /** @type {((inputs?: Hardware_AccelerationInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hardware_AccelerationInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hardware_acceleration(inputs)
	return zh_hardware_acceleration(inputs)
});