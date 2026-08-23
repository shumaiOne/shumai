/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Changes_RequestedInputs */

const en_changes_requested = /** @type {(inputs: Changes_RequestedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Changes requested`)
};

const zh_changes_requested = /** @type {(inputs: Changes_RequestedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已请求修改`)
};

/**
* | output |
* | --- |
* | "Changes requested" |
*
* @param {Changes_RequestedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const changes_requested = /** @type {((inputs?: Changes_RequestedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Changes_RequestedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_changes_requested(inputs)
	return zh_changes_requested(inputs)
});