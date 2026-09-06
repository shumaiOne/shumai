/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_ModalitiesInputs */

const en_all_modalities = /** @type {(inputs: All_ModalitiesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All`)
};

const zh_all_modalities = /** @type {(inputs: All_ModalitiesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`全部`)
};

/**
* | output |
* | --- |
* | "All" |
*
* @param {All_ModalitiesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_modalities = /** @type {((inputs?: All_ModalitiesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_ModalitiesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_all_modalities(inputs)
	return zh_all_modalities(inputs)
});