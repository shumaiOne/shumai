/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Approve_TaskInputs */

const en_approve_task = /** @type {(inputs: Approve_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Approve`)
};

const zh_approve_task = /** @type {(inputs: Approve_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`批准`)
};

/**
* | output |
* | --- |
* | "Approve" |
*
* @param {Approve_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const approve_task = /** @type {((inputs?: Approve_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Approve_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_approve_task(inputs)
	return zh_approve_task(inputs)
});