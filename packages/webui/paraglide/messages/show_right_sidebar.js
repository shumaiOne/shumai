/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Show_Right_SidebarInputs */

const en_show_right_sidebar = /** @type {(inputs: Show_Right_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show Right Sidebar`)
};

const zh_show_right_sidebar = /** @type {(inputs: Show_Right_SidebarInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`显示右侧边栏`)
};

/**
* | output |
* | --- |
* | "Show Right Sidebar" |
*
* @param {Show_Right_SidebarInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const show_right_sidebar = /** @type {((inputs?: Show_Right_SidebarInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Show_Right_SidebarInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_show_right_sidebar(inputs)
	return zh_show_right_sidebar(inputs)
});