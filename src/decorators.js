import Types from './Types';

/**
 * Class member decorator generator for Binary class property
 * @param {@link Types[*]} (destructured) - Any element from the Types imported object from './Types'
 * @return {function} - The decorator {@linc decorator} to be used to transform a class member into binary backed
 */
const binary = ({bytes, get, set}) => {
  /**
   * The class member generated decorator
   * @param {object} target - is an object which will be `assign`ed to the Class.prototype
   * @param {string} name - is the class property name
   * @param {object} `descriptor` is a descriptor as in `Object.defineProperty(target, name, descriptor)`
   * @return {object} - The new or modified descriptor for this class member
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

    return {
      // TODO: Do something with initializer as default value
      configurable: false,
      enumerable: true,
      /**
       * Returns the value handled by this class member
       * @return {any} - The value in memory, translated by the Type.* getter
       */
      get() {
        return get(this._dv, this._initialOffset + offset)
      },
      /**
       * Modifies the value handled by this class member
       * @param {any} value - The new value to be assigned, which will be translated by the Types.* setter
       * @return {boolean} - Always true, as needed by JS setters
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
 * @param {*} Class - A class not extending Binary containing `@binary` members
 * @return {@link wrapper} A {@link Class} instantiator
 * */
const withBinary = (Class) => {
  /**
   * Class wrapper (object constructor)
   * @param {ArrayBuffer/SharedArrayBuffer/DataView} binOrDV - The buffer where the data lives
   * @param {number} initialOffset - Buffer offset before this object data start
   * @param {array} args - Any arguments passed to the class constructor
   * @return {@link Class} instance
   * */
  const wrapper = (binOrDV, initialOffset=0, ...args) => {
    const target = new Class(...args);
    target._dv = (binOrDV instanceof DataView)
      ? binOrDV
      : new DataView(binOrDV);
    target._initialOffset = initialOffset;

    // Get a single byte (as unsigned integer) from a position
    // @param {number} offset - The position of the byte to get
    // @return {number} The unsigned numeric value at this byte
    //@nonenumerable
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

  // Allow getting the class size and props from outside (as static)
  Object.defineProperty(wrapper, 'binarySize', {
    get() { return Class._size },
    configurable: false,
    enumerable: false,
  });
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
