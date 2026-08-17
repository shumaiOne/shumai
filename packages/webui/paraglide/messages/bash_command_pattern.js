/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Bash_Command_PatternInputs */

const en_bash_command_pattern = /** @type {(inputs: Bash_Command_PatternInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bash Match Wildcard`)
};

const zh_bash_command_pattern = /** @type {(inputs: Bash_Command_PatternInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bash 命令通配符`)
};

/**
* | output |
* | --- |
* | "Bash Match Wildcard" |
*
* @param {Bash_Command_PatternInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const bash_command_pattern = /** @type {((inputs?: Bash_Command_PatternInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Bash_Command_PatternInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_bash_command_pattern(inputs)
	return zh_bash_command_pattern(inputs)
});