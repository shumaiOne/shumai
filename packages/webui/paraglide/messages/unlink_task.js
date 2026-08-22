/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Unlink_TaskInputs */

const en_unlink_task = /** @type {(inputs: Unlink_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unlink Task`)
};

const zh_unlink_task = /** @type {(inputs: Unlink_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`取消关联`)
};

/**
* | output |
* | --- |
* | "Unlink Task" |
*
* @param {Unlink_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const unlink_task = /** @type {((inputs?: Unlink_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Unlink_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_unlink_task(inputs)
	return zh_unlink_task(inputs)
});