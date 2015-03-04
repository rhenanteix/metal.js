'use strict';

/**
 * A collection of core utility functions.
 * @const
 */
class core {
  /**
   * When defining a class Foo with an abstract method bar(), you can do:
   * Foo.prototype.bar = core.abstractMethod
   *
   * Now if a subclass of Foo fails to override bar(), an error will be thrown
   * when bar() is invoked.
   *
   * @type {!Function}
   * @throws {Error} when invoked to indicate the method should be overridden.
   */
  static abstractMethod() {
    throw Error('Unimplemented abstract method');
  }

  /**
   * Loops constructor super classes collecting its properties values. If
   * property is not available on the super class `undefined` will be
   * collected as value for the class hierarchy position. Must be used with
   * classes created using `core.inherits`.
   * @param {!function()} constructor Class constructor.
   * @param {string} propertyName Property name to be collected.
   * @return {Array.<*>} Array of collected values.
   * TODO(*): Rethink superclass loop.
   */
  static collectSuperClassesProperty(constructor, propertyName) {
    var propertyValues = [constructor[propertyName]];

    if (constructor.superClass_) {
      while (constructor.superClass_) {
        constructor = constructor.superClass_.constructor;
        propertyValues.push(constructor[propertyName]);
      }
    }
    else {
      while (!constructor.__proto__.isPrototypeOf(Function)) {
        constructor = constructor.__proto__;
        propertyValues.push(constructor[propertyName]);
      }
    }
    return propertyValues;
  }

  /**
   * Gets an unique id. If `opt_object` argument is passed, the object is
   * mutated with an unique id. Consecutive calls with the same object
   * reference won't mutate the object again, instead the current object uid
   * returns. See {@link core.UID_PROPERTY}.
   * @type {opt_object} Optional object to be mutated with the uid. If not
   *     specified this method only returns the uid.
   * @throws {Error} when invoked to indicate the method should be overridden.
   */
  static getUid(opt_object) {
    if (opt_object) {
      return opt_object[core.UID_PROPERTY] ||
        (opt_object[core.UID_PROPERTY] = core.uniqueIdCounter_++);
    }
    return core.uniqueIdCounter_++;
  }

  /**
   * Inherits the prototype methods from one constructor into another.
   *
   * Usage:
   * <pre>
   * function ParentClass(a, b) { }
   * ParentClass.prototype.foo = function(a) { }
   *
   * function ChildClass(a, b, c) {
   *   core.base(this, a, b);
   * }
   * core.inherits(ChildClass, ParentClass);
   *
   * var child = new ChildClass('a', 'b', 'c');
   * child.foo();
   * </pre>
   *
   * @param {Function} childCtor Child class.
   * @param {Function} parentCtor Parent class.
   */
  static inherits(childCtor, parentCtor) {
    function TempCtor() {
    }
    TempCtor.prototype = parentCtor.prototype;
    childCtor.superClass_ = parentCtor.prototype;
    childCtor.prototype = new TempCtor();
    childCtor.prototype.constructor = childCtor;

    /**
     * Calls superclass constructor/method.
     *
     * This function is only available if you use core.inherits to express
     * inheritance relationships between classes.
     *
     * @param {!object} me Should always be "this".
     * @param {string} methodName The method name to call. Calling superclass
     *     constructor can be done with the special string 'constructor'.
     * @param {...*} var_args The arguments to pass to superclass
     *     method/constructor.
     * @return {*} The return value of the superclass method/constructor.
     */
    childCtor.base = function(me, methodName) {
      var args = Array.prototype.slice.call(arguments, 2);
      return parentCtor.prototype[methodName].apply(me, args);
    };
  }

  /**
   * The identity function. Returns its first argument.
   * @param {*=} opt_returnValue The single value that will be returned.
   * @return {?} The first argument.
   */
  static identityFunction(opt_returnValue) {
    return opt_returnValue;
  }

  /**
   * Returns true if the specified value is a boolean.
   * @param {?} val Variable to test.
   * @return {boolean} Whether variable is boolean.
   */
  static isBoolean(val) {
    return typeof val === 'boolean';
  }

  /**
   * Returns true if the specified value is not undefined.
   * @param {?} val Variable to test.
   * @return {boolean} Whether variable is defined.
   */
  static isDef(val) {
    return val !== undefined;
  }

  /**
   * Returns true if value is not undefined or null.
   * @param {*} val
   * @return {Boolean}
   */
  static isDefAndNotNull(val) {
    return core.isDef(val) && !core.isNull(val);
  }

  /**
   * Returns true if value is a dom element.
   * @param {*} val
   * @return {Boolean}
   */
  static isElement(val) {
    return val && typeof val === 'object' && val.nodeType === 1;
  }

  /**
   * Returns true if the specified value is a function.
   * @param {?} val Variable to test.
   * @return {boolean} Whether variable is a function.
   */
  static isFunction(val) {
    return typeof val === 'function';
  }

  /**
   * Returns true if value is null.
   * @param {*} val
   * @return {Boolean}
   */
  static isNull(val) {
    return val === null;
  }

  /**
   * Returns true if the specified value is an object. This includes arrays
   * and functions.
   * @param {?} val Variable to test.
   * @return {boolean} Whether variable is an object.
   */
  static isObject(val) {
    var type = typeof val;
    return type === 'object' && val !== null || type === 'function';
  }

  /**
   * Returns true if value is a string.
   * @param {*} val
   * @return {Boolean}
   */
  static isString(val) {
    return typeof val === 'string';
  }

  /**
   * Merges the values of a static property a class with the values of that
   * property for all its super classes, and stores it as a new static
   * property of that class. If the static property already existed, it won't
   * be recalculated.
   * @param {!function()} constructor Class constructor.
   * @param {string} propertyName Property name to be collected.
   * @param {function(*, *):*=} opt_mergeFn Function that receives an array filled
   *   with the values of the property for the current class and all its super classes.
   *   Should return the merged value to be stored on the current class.
   * @return {*} The value of the merged property.
   */
  static mergeSuperClassesProperty(constructor, propertyName, opt_mergeFn) {
    var mergedName = propertyName + '_MERGED';
    if (constructor.hasOwnProperty(mergedName)) {
      return constructor[mergedName];
    }

    var merged = core.collectSuperClassesProperty(constructor, propertyName);
    if (opt_mergeFn) {
      merged = opt_mergeFn(merged);
    }
    constructor[mergedName] = merged;
    return constructor[mergedName];
  }

  /**
   * Null function used for default values of callbacks, etc.
   * @return {void} Nothing.
   */
  static nullFunction() {

  }
}

/**
 * Unique id property prefix.
 * @type {String}
 * @protected
 */
core.UID_PROPERTY = 'core_' + ((Math.random() * 1e9) >>> 0);

/**
 * Counter for unique id.
 * @type {Number}
 * @private
 */
core.uniqueIdCounter_ = 1;

export default core;