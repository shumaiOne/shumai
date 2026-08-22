/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Link_To_TaskInputs */

const en_link_to_task = /** @type {(inputs: Link_To_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Link to Task`)
};

const zh_link_to_task = /** @type {(inputs: Link_To_TaskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`关联到任务`)
};

/**
* | output |
* | --- |
* | "Link to Task" |
*
* @param {Link_To_TaskInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const link_to_task = /** @type {((inputs?: Link_To_TaskInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Link_To_TaskInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_link_to_task(inputs)
	return zh_link_to_task(inputs)
});