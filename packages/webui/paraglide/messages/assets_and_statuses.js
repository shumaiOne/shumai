/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Assets_And_StatusesInputs */

const en_assets_and_statuses = /** @type {(inputs: Assets_And_StatusesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Assets & Statuses`)
};

const zh_assets_and_statuses = /** @type {(inputs: Assets_And_StatusesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`素材与状态`)
};

/**
* | output |
* | --- |
* | "Assets & Statuses" |
*
* @param {Assets_And_StatusesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const assets_and_statuses = /** @type {((inputs?: Assets_And_StatusesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Assets_And_StatusesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_assets_and_statuses(inputs)
	return zh_assets_and_statuses(inputs)
});