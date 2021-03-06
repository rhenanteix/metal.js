'use strict';

import {getFunctionName, isDefAndNotNull} from 'metal';

const ERROR_OBJECT_OF_TYPE = 'Expected object of one type.';
const ERROR_ONE_OF = 'Expected one of the following values:';
const ERROR_ONE_OF_TYPE = 'Expected one of given types.';

/**
 * Provides access to various type validators that will return an
 * instance of Error when validation fails. Note that all type validators
 * will also accept null or undefined values. To not accept these you should
 * instead make your state property required.
 */
const validators = {
	any: () => () => true,
	array: buildTypeValidator('array'),
	bool: buildTypeValidator('boolean'),
	func: buildTypeValidator('function'),
	number: buildTypeValidator('number'),
	object: buildTypeValidator('object'),
	string: buildTypeValidator('string'),

	/**
	 * Creates a validator that checks that the value it receives is an array
	 * of items, and that all of the items pass the given validator.
	 * @param {!function()} validator Validator to check each item against.
	 * @return {!function()}
	 */
	arrayOf: function(validator) {
		if (isInvalid(validators.func(validator))) {
			throwConfigError('function', validator, 'arrayOf');
		}
		return maybe((value, name, context) => {
			const result = validators.array(value, name, context);
			if (isInvalid(result)) {
				return result;
			}
			return validateArrayItems(validator, value, name, context);
		});
	},

	/**
	 * Creates a validator that checks for a value within a range.
	 * @param {!Number} min The minimum value allowed.
	 * @param {!Number} max The maximum value allowed.
	 * @return {!function()}
	 */
	inRange: function(min, max) {
		const minResult = validators.number(min);
		const maxResult = validators.number(max);
		if (isInvalid(minResult)) {
			return minResult;
		}
		if (isInvalid(maxResult)) {
			return maxResult;
		}
		return maybe(value => {
			const valueResult = validators.number(value);
			if (isInvalid(valueResult)) {
				return valueResult;
			}
			return value >= min && value <= max;
		});
	},

	/**
	 * Creates a validator that checks if a value is an instance of a given class.
	 * @param {!function()} expectedClass Class to check value against.
	 * @return {!function()}
	 */
	instanceOf: function(expectedClass) {
		return maybe((value, name, context) => {
			if (value instanceof expectedClass) {
				return true;
			}
			const msg = `Expected instance of ${expectedClass}`;
			return composeError(msg, name, context);
		});
	},

	/**
	 * Creates a validator that checks that the value it receives is an object,
	 * and that all values within that object pass the given validator.
	 * @param {!function()} validator Validator to check each object value against.
	 * @return {!function()}
	 */
	objectOf: function(validator) {
		if (isInvalid(validators.func(validator))) {
			throwConfigError('function', validator, 'objectOf');
		}
		return maybe((value, name, context) => {
			for (let key in value) {
				if (isInvalid(validator(value[key]))) {
					return composeError(ERROR_OBJECT_OF_TYPE, name, context);
				}
			}
			return true;
		});
	},

	/**
	 * Creates a validator that checks if the received value matches one of the
	 * given values.
	 * @param {!Array} arrayOfValues Array of values to check equality against.
	 * @return {!function()}
	 */
	oneOf: function(arrayOfValues) {
		return maybe((value, name, context) => {
			const result = validators.array(arrayOfValues, name, context);
			if (isInvalid(result)) {
				return result;
			}
			return arrayOfValues.indexOf(value) === -1
				? composeError(
					composeOneOfErrorMessage(arrayOfValues),
					name,
					context
					) // eslint-disable-line
				: true;
		});
	},

	/**
	 * Creates a validator that checks if the received value matches one of the
	 * given types.
	 * @param {!Array} arrayOfTypeValidators Array of validators to check value
	 *     against.
	 * @return {!function()}
	 */
	oneOfType: function(arrayOfTypeValidators) {
		return maybe((value, name, context) => {
			const result = validators.array(
				arrayOfTypeValidators,
				name,
				context
			); // eslint-disable-line
			if (isInvalid(result)) {
				return result;
			}

			for (let i = 0; i < arrayOfTypeValidators.length; i++) {
				// eslint-disable-next-line
				if (
					!isInvalid(arrayOfTypeValidators[i](value, name, context))
				) {
					return true;
				}
			}
			return composeError(ERROR_ONE_OF_TYPE, name, context);
		});
	},

	/**
	 * Creates a validator that checks if the received value is an object, and
	 * that its contents match the given shape.
	 * @param {!Object} shape An object containing validators for each key.
	 * @return {!function()}
	 */
	shapeOf: function(shape) {
		if (isInvalid(validators.object(shape))) {
			throwConfigError('object', shape, 'shapeOf');
		}
		return maybe((value, name, context) => {
			const valueResult = validators.object(value, name, context);
			if (isInvalid(valueResult)) {
				return valueResult;
			}
			for (let key in shape) {
				if (Object.prototype.hasOwnProperty.call(shape, key)) {
					let validator = shape[key];
					let required = false;
					if (validator.config) {
						required = validator.config.required;
						validator = validator.config.validator;
					}
					if (
						(required && !isDefAndNotNull(value[key])) ||
						isInvalid(validator(value[key]))
					) {
						return validator(value[key], `${name}.${key}`, context);
					}
				}
			}
			return true;
		});
	},
};

/**
 * Creates a validator that checks against a specific primitive type.
 * @param {string} expectedType Type to check against.
 * @return {!function()} Function that runs the validator if called with
 *     arguments, or just returns it otherwise. This means that when using a
 *     type validator in `State` it may be just passed directly (like
 *     `validators.bool`), or called with no args (like `validators.bool()`).
 *     That's done to allow all validators to be used consistently, since some
 *     (like `arrayOf`) always require that you call the function before
 *     receiving the actual validator. Type validators don't need the call, but
 *     work if it's made anyway.
 */
function buildTypeValidator(expectedType) {
	const validatorFn = maybe(validateType.bind(null, expectedType));
	return (...args) => {
		if (args.length === 0) {
			return validatorFn;
		} else {
			return validatorFn(...args);
		}
	};
}

/**
 * Composes a warning a warning message.
 * @param {string} error Error message to display to console.
 * @param {?string} name Name of state property that is giving the error.
 * @param {Object} context The property's owner.
 * @return {!Error}
 */
function composeError(error, name, context) {
	const compName = context ? getFunctionName(context.constructor) : null;
	const renderer = context && context.getRenderer && context.getRenderer();
	const parent = renderer && renderer.getParent && renderer.getParent();
	const parentName = parent ? getFunctionName(parent.constructor) : null;
	const location = parentName
		? `Check render method of '${parentName}'.`
		: '';
	return new Error(
		`Invalid state passed to '${name}'.` +
			` ${error} Passed to '${compName}'. ${location}`
	);
}

/**
 * Composes an error message for Config.oneOf validator.
 * @param {!Array} arrayOfValues Array of values to check equality against.
 * @return {!Error}
 */
function composeOneOfErrorMessage(arrayOfValues) {
	return `${ERROR_ONE_OF} ${JSON.stringify(arrayOfValues)}.`;
}

/**
 * Returns the type of the given value.
 * @param {*} value Any value.
 * @return {string} Type of value.
 */
function getType(value) {
	return Array.isArray(value) ? 'array' : typeof value;
}

/**
 * Checks if the given validator result says that the value is invalid.
 * @param {boolean|!Error} result
 * @return {boolean}
 */
function isInvalid(result) {
	return result instanceof Error;
}

/**
 * Wraps the given validator so that it also accepts null/undefined values.
 *   a validator that checks a value against a single type, null, or
 * undefined.
 * @param {!function()} typeValidator Validator to wrap.
 * @return {!function()} Wrapped validator.
 */
function maybe(typeValidator) {
	return (value, name, context) => {
		return isDefAndNotNull(value)
			? typeValidator(value, name, context)
			: true; // eslint-disable-line
	};
}

/**
 * Throws error if validator is invoked with incorrect type.
 * @param {string} expectedType String representing the expected type.
 * @param {*} value The value to match the type of.
 * @param {!string} name Name of the function the validator is intended for.
 */
function throwConfigError(expectedType, value, name) {
	const type = getType(value);
	throw new Error(
		`Expected type ${expectedType}, but received type ${type}. passed to ${
			name
		}.`
	);
}

/**
 * Checks if all the items of the given array pass the given validator.
 * @param {!function()} validator
 * @param {*} value The array to validate items for.
 * @param {string} name The name of the array property being checked.
 * @param {!Object} context Owner of the array property being checked.
 * @return {!Error|boolean} `true` if the type matches, or an error otherwise.
 */
function validateArrayItems(validator, value, name, context) {
	for (let i = 0; i < value.length; i++) {
		if (isInvalid(validator(value[i], name, context))) {
			let itemValidatorError = validator(value[i], name, context);
			let errorMessage = `Validator for ${name}[${i}] says: "${
				itemValidatorError
			}"`;
			return composeError(errorMessage, name, context);
		}
	}
	return true;
}

/**
 * Checks if the given value matches the expected type.
 * @param {string} expectedType String representing the expected type.
 * @param {*} value The value to match the type of.
 * @param {string} name The name of the property being checked.
 * @param {!Object} context Owner of the property being checked.
 * @return {!Error|boolean} `true` if the type matches, or an error otherwise.
 */
function validateType(expectedType, value, name, context) {
	const type = getType(value);
	if (type !== expectedType) {
		const msg = `Expected type '${expectedType}', but received type '${
			type
		}'.`;
		return composeError(msg, name, context);
	}
	return true;
}

export default validators;
