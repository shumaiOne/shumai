/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_UpdatedInputs */

const en_settings_updated = /** @type {(inputs: Settings_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Settings updated`)
};

const zh_settings_updated = /** @type {(inputs: Settings_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`设置已更新`)
};

/**
* | output |
* | --- |
* | "Settings updated" |
*
* @param {Settings_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const settings_updated = /** @type {((inputs?: Settings_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_updated(inputs)
	return zh_settings_updated(inputs)
});