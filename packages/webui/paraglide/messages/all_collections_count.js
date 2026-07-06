/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} All_Collections_CountInputs */

const en_all_collections_count = /** @type {(inputs: All_Collections_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`All Collections (${i?.count})`)
};

const zh_all_collections_count = /** @type {(inputs: All_Collections_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`所有媒体合集 (${i?.count})`)
};

/**
* | output |
* | --- |
* | "All Collections ({count})" |
*
* @param {All_Collections_CountInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_collections_count = /** @type {((inputs: All_Collections_CountInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_Collections_CountInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_all_collections_count(inputs)
	return zh_all_collections_count(inputs)
});