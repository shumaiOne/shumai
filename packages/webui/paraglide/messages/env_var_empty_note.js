/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Env_Var_Empty_NoteInputs */

const en_env_var_empty_note = /** @type {(inputs: Env_Var_Empty_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`If left empty, the value will be read from the host machine's environment.`)
};

const zh_env_var_empty_note = /** @type {(inputs: Env_Var_Empty_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`如果留空，将从主机的环境中读取值。`)
};

/**
* | output |
* | --- |
* | "If left empty, the value will be read from the host machine's environment." |
*
* @param {Env_Var_Empty_NoteInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const env_var_empty_note = /** @type {((inputs?: Env_Var_Empty_NoteInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Env_Var_Empty_NoteInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_env_var_empty_note(inputs)
	return zh_env_var_empty_note(inputs)
});