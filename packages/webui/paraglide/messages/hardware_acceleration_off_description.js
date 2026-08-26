/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hardware_Acceleration_Off_DescriptionInputs */

const en_hardware_acceleration_off_description = /** @type {(inputs: Hardware_Acceleration_Off_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Uses software libx264 encoder with constant rate factor (CRF).`)
};

const zh_hardware_acceleration_off_description = /** @type {(inputs: Hardware_Acceleration_Off_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`使用 CPU 的 libx264 软件编码器及 CRF 恒定画质模式。`)
};

/**
* | output |
* | --- |
* | "Uses software libx264 encoder with constant rate factor (CRF)." |
*
* @param {Hardware_Acceleration_Off_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_off_description = /** @type {((inputs?: Hardware_Acceleration_Off_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hardware_Acceleration_Off_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hardware_acceleration_off_description(inputs)
	return zh_hardware_acceleration_off_description(inputs)
});