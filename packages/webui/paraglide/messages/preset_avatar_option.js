/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Preset_Avatar_OptionInputs */

const en_preset_avatar_option = /** @type {(inputs: Preset_Avatar_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Preset Avatar Option`)
};

const zh_preset_avatar_option = /** @type {(inputs: Preset_Avatar_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`预设头像选项`)
};

/**
* | output |
* | --- |
* | "Preset Avatar Option" |
*
* @param {Preset_Avatar_OptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const preset_avatar_option = /** @type {((inputs?: Preset_Avatar_OptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Preset_Avatar_OptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_preset_avatar_option(inputs)
	return zh_preset_avatar_option(inputs)
});