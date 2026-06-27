/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Card_ViewInputs */

const en_card_view = /** @type {(inputs: Card_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Card View`)
};

const zh_card_view = /** @type {(inputs: Card_ViewInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`卡片视图`)
};

/**
* | output |
* | --- |
* | "Card View" |
*
* @param {Card_ViewInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const card_view = /** @type {((inputs?: Card_ViewInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Card_ViewInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_card_view(inputs)
	return zh_card_view(inputs)
});