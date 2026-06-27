/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Renamed_ToInputs */

const en_renamed_to = /** @type {(inputs: Renamed_ToInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Renamed to`)
};

const zh_renamed_to = /** @type {(inputs: Renamed_ToInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已重命名为`)
};

/**
* | output |
* | --- |
* | "Renamed to" |
*
* @param {Renamed_ToInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const renamed_to = /** @type {((inputs?: Renamed_ToInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Renamed_ToInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_renamed_to(inputs)
	return zh_renamed_to(inputs)
});