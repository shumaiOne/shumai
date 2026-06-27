/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} SavingInputs */

const en_saving = /** @type {(inputs: SavingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Saving`)
};

const zh_saving = /** @type {(inputs: SavingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`保存中`)
};

/**
* | output |
* | --- |
* | "Saving" |
*
* @param {SavingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const saving = /** @type {((inputs?: SavingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<SavingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_saving(inputs)
	return zh_saving(inputs)
});