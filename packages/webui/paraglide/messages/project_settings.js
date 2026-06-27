/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_SettingsInputs */

const en_project_settings = /** @type {(inputs: Project_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project Settings`)
};

const zh_project_settings = /** @type {(inputs: Project_SettingsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目设置`)
};

/**
* | output |
* | --- |
* | "Project Settings" |
*
* @param {Project_SettingsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_settings = /** @type {((inputs?: Project_SettingsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_SettingsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_settings(inputs)
	return zh_project_settings(inputs)
});