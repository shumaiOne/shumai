/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hardware_Acceleration_OffInputs */

const en_hardware_acceleration_off = /** @type {(inputs: Hardware_Acceleration_OffInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Disabled (Software)`)
};

const zh_hardware_acceleration_off = /** @type {(inputs: Hardware_Acceleration_OffInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已禁用 (软件编码)`)
};

/**
* | output |
* | --- |
* | "Disabled (Software)" |
*
* @param {Hardware_Acceleration_OffInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_off = /** @type {((inputs?: Hardware_Acceleration_OffInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hardware_Acceleration_OffInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hardware_acceleration_off(inputs)
	return zh_hardware_acceleration_off(inputs)
});