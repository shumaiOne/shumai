/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Linked_Assets_CountInputs */

const en_linked_assets_count = /** @type {(inputs: Linked_Assets_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} assets`)
};

const zh_linked_assets_count = /** @type {(inputs: Linked_Assets_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} 个资产`)
};

/**
* | output |
* | --- |
* | "{count} assets" |
*
* @param {Linked_Assets_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const linked_assets_count = /** @type {((inputs: Linked_Assets_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Linked_Assets_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_linked_assets_count(inputs)
	return zh_linked_assets_count(inputs)
});