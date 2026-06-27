/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_ProjectInputs */

const en_create_project = /** @type {(inputs: Create_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Project`)
};

const zh_create_project = /** @type {(inputs: Create_ProjectInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建项目`)
};

/**
* | output |
* | --- |
* | "Create Project" |
*
* @param {Create_ProjectInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_project = /** @type {((inputs?: Create_ProjectInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_ProjectInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_project(inputs)
	return zh_create_project(inputs)
});