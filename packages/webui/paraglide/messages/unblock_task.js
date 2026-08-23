/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unblock_TaskInputs */

const en_unblock_task = /** @type {(inputs: Unblock_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unblock`)
};

const zh_unblock_task = /** @type {(inputs: Unblock_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`解除阻塞`)
};

/**
* | output |
* | --- |
* | "Unblock" |
*
* @param {Unblock_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unblock_task = /** @type {((inputs?: Unblock_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unblock_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unblock_task(inputs)
	return zh_unblock_task(inputs)
});