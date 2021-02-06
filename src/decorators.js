import Types from './Types';

/**
 * Class member decorator generator for Binary class property
 * @param {object} type - Any element from the {@link Types}
 * @return {function} - The {@link decorator} which generates the {@link propertyDescriptor} to be used to transform a class member into binary backed member
 * @decorator
 * @method
 */
const binary = ({bytes, get, set}) => {
  /**
   * The class member generated decorator
   * @param {object} target - object which will be `assign`ed to the Class.prototype
   * @param {string} name - property name
   * @param {object} descriptor - descriptor as in `Object.defineProperty(target, name, descriptor)`, like {@link propertyDescriptor}
   * @return {object} - The new or modified {@link propertyDescriptor} for this class member
   * @method
   * @name decorator
   */
  return function decorator(target, name, descriptor) {
    //const deleted = (() => {
    //  const {value, initializer, writable} = descriptor;
    //  return {value, initializer, writable};
    //})();

    // Add size as static property to Class
    target.constructor._size = target.constructor._size ?? 0;
    target.constructor._binaryProps = target.constructor._binaryProps ?? [];

    // Get this property offset
    const offset = target.constructor._size;

    // Add property size to Class size (at static Class property)
    target.constructor._size += bytes;
    target.constructor._binaryProps.push(name);

    /**
     * Property definition returned from {@link binary}'s returned {@link decorator}
     * @name propertyDescriptor
     */
    return {
      // TODO: Do something with initializer as default value
      configurable: false,
      enumerable: true,

      /**
       * Returns the value handled by this class member, defined at its {@link Types}
       * @return {any} - The value in memory, translated by the {@link Types} getter
       * @this Binary instance
       * @name propertyDescriptorGetter
       */
      get() {
        return get(this._dv, this._initialOffset + offset)
      },

      /**
       * Modifies the value handled by this class member, defined at its {@link Types}
       * @param {any} value - The new value to be assigned, which will be translated by the {@link Types} setter
       * @return {boolean} - Always true, as needed by JS setters
       * @this Binary instance
       * @name propertyDescriptorSetter
       */
      set(value) {
        set(this._dv, this._initialOffset + offset, value);
        return true;
      },
    };

    return descriptor;
  };
}


// Using `withBinary` as class decorator is 4x times faster in
// instantiation (if using @nonenumerable), at the cost of losing some
// JS class syntax benefits.
// If using withBinary, don't use `extend Binary` and don't use `new` either.
/**
 * Decorator to add Binary behavior to a class containing `@binary` members, but
 * without extending Binary class
 * @param {class} Class - A class not extending Binary containing `@binary` members
 * @return {@link wrapper} A {@link Class} instantiator
 * */
const withBinary = (Class) => {
  /**
   * Class wrapper (object constructor)
   * @param {ArrayBuffer/SharedArrayBuffer/DataView} binOrDV - The buffer where the data lives
   * @param {number} initialOffset - Buffer offset before this object data start
   * @param {array} args - Any arguments passed to the class constructor
   * @return {@link Class} instance
   * @callback wrapper
   * */
  const wrapper = (binOrDV, initialOffset=0, ...args) => {
    const target = new Class(...args);
    target._dv = (binOrDV instanceof DataView)
      ? binOrDV
      : new DataView(binOrDV);
    target._initialOffset = initialOffset;

    /**
     * Get a single byte (as unsigned integer) from a position
     * @param {number} offset - The position of the byte to get
     * @return {number} The unsigned numeric value at this byte
     * @this {@link Class} instance
     */
    target.getByteAt = (offset) => Types.Uint8.get(this._dv, this._initialOffset + offset);

    // This is desirable, but slowers down instantiation time by 4x times
    // Note: `defineProperties` is +0,25 slower
    /*
    Object.defineProperty(target,
      '_dv', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: new DataView(bin, initialOffset, Class._size),
      });
    Object.defineProperty(target,
      '_initialOffset', {
        enumerable: false,
        configurable: false,
        writable: false,
        value: initialOffset,
      });
    */
    return target;
  };

  /**
   * Allow getting the class size from outside
   * @this wrapper
   * @static
   * @method
   * @name binarySize
   */
  Object.defineProperty(wrapper, 'binarySize', {
    get() { return Class._size },
    configurable: false,
    enumerable: false,
  });

  /**
   * Allow getting the class binary props from outside
   * @this wrapper
   * @static
   * @method
   * @name binarySize
   */
  Object.defineProperty(wrapper, 'binaryProps', {
    get() { return Class._binaryProps },
    configurable: false,
    enumerable: false,
  });

  /**
   * Array creator helper
   * @param {ArrayBuffer/SharedArrayBuffer/DataView} binOrDv - The buffer where the data lives
   * @param {number} length - The length of elements to create
   * @param {number} initialOffset - The initial offset in the buffer before the first element of the array
   * @param {array} list - The array where new objects will be added
   * @return {array} - The array {@link list} where the objects have been added
   * @this wrapper
   * @static
   * @method
   */
  wrapper.arrayFactory = function(binOrDV, length, initialOffset=0, list=[]) {
    // Optimize: Generate a single DataView for all elements
    const dv = binOrDV instanceof DataView
      ? binOrDV
      : new DataView(binOrDV, initialOffset, length * Class._size)

    for(let i = 0; i < length; i++) {
      list.push(wrapper(dv, initialOffset + Class._size * i));
    }

    return list
  }

  return wrapper;
}

export {withBinary, binary};
