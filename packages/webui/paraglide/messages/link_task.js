/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Link_TaskInputs */

const en_link_task = /** @type {(inputs: Link_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Link Task`)
};

const zh_link_task = /** @type {(inputs: Link_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`关联任务`)
};

/**
* | output |
* | --- |
* | "Link Task" |
*
* @param {Link_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const link_task = /** @type {((inputs?: Link_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Link_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_link_task(inputs)
	return zh_link_task(inputs)
});