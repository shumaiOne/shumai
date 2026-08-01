/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ActionInputs */

const en_action = /** @type {(inputs: ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Action`)
};

const zh_action = /** @type {(inputs: ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`操作`)
};

/**
* | output |
* | --- |
* | "Action" |
*
* @param {ActionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const action = /** @type {((inputs?: ActionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ActionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_action(inputs)
	return zh_action(inputs)
});