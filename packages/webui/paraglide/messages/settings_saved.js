/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_SavedInputs */

const en_settings_saved = /** @type {(inputs: Settings_SavedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Settings saved successfully`)
};

const zh_settings_saved = /** @type {(inputs: Settings_SavedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`设置保存成功`)
};

/**
* | output |
* | --- |
* | "Settings saved successfully" |
*
* @param {Settings_SavedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const settings_saved = /** @type {((inputs?: Settings_SavedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_SavedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_saved(inputs)
	return zh_settings_saved(inputs)
});