/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_UpdateInputs */

const en_failed_update = /** @type {(inputs: Failed_UpdateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to update`)
};

const zh_failed_update = /** @type {(inputs: Failed_UpdateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更新失败`)
};

/**
* | output |
* | --- |
* | "Failed to update" |
*
* @param {Failed_UpdateInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_update = /** @type {((inputs?: Failed_UpdateInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_UpdateInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_update(inputs)
	return zh_failed_update(inputs)
});