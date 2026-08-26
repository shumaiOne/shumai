/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hardware_Acceleration_Auto_DescriptionInputs */

const en_hardware_acceleration_auto_description = /** @type {(inputs: Hardware_Acceleration_Auto_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Automatically probes and uses GPU/Hardware acceleration (NVENC, QSV, AMF, VideoToolbox). If hardware acceleration is unsupported on the host, video transcoding may fail.`)
};

const zh_hardware_acceleration_auto_description = /** @type {(inputs: Hardware_Acceleration_Auto_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自动检测并使用 GPU/硬件加速（NVENC、QSV、AMF、VideoToolbox）。若宿主硬件不支持加速，视频转码可能会失败。`)
};

/**
* | output |
* | --- |
* | "Automatically probes and uses GPU/Hardware acceleration (NVENC, QSV, AMF, VideoToolbox). If hardware acceleration is unsupported on the host, video transcodi..." |
*
* @param {Hardware_Acceleration_Auto_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const hardware_acceleration_auto_description = /** @type {((inputs?: Hardware_Acceleration_Auto_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hardware_Acceleration_Auto_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_hardware_acceleration_auto_description(inputs)
	return zh_hardware_acceleration_auto_description(inputs)
});