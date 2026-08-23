/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Reopen_TaskInputs */

const en_reopen_task = /** @type {(inputs: Reopen_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reopen`)
};

const zh_reopen_task = /** @type {(inputs: Reopen_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`重新打开`)
};

/**
* | output |
* | --- |
* | "Reopen" |
*
* @param {Reopen_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const reopen_task = /** @type {((inputs?: Reopen_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Reopen_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_reopen_task(inputs)
	return zh_reopen_task(inputs)
});