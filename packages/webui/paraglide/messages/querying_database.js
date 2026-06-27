/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Querying_DatabaseInputs */

const en_querying_database = /** @type {(inputs: Querying_DatabaseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Querying database...`)
};

const zh_querying_database = /** @type {(inputs: Querying_DatabaseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`正在查询数据库...`)
};

/**
* | output |
* | --- |
* | "Querying database..." |
*
* @param {Querying_DatabaseInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const querying_database = /** @type {((inputs?: Querying_DatabaseInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Querying_DatabaseInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_querying_database(inputs)
	return zh_querying_database(inputs)
});