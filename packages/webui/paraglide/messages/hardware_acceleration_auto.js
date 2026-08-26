/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hardware_Acceleration_AutoInputs */

const en_hardware_acceleration_auto = /** @type {(inputs: Hardware_Acceleration_AutoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Auto Detect`)
};

const zh_hardware_acceleration_auto = /** @type {(inputs: Hardware_Acceleration_AutoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自动检测`)
};

/**
* | output |
* | --- |
* | "Auto Detect" |
*
* @param {Hardware_Acceleration_AutoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_auto = /** @type {((inputs?: Hardware_Acceleration_AutoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hardware_Acceleration_AutoInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hardware_acceleration_auto(inputs)
	return zh_hardware_acceleration_auto(inputs)
});