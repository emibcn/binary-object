import Types from './Types';

// Class member decorator:
// - Target: Binary class property
// - Arguments:
//   - type: Types.* (from './Types')
const binary = ({bytes, get, set}) => {
  // Run only once
  // `target` is an object which will be `assign`ed to Class.prototype
  // `name` is the class property name
  // `descriptor` is a descriptor as in `Object.defineProperty(target, name, descriptor)`
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
      get() {
        return get(this._dv, this._initialOffset + offset)
      },
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
const withBinary = (Class) => {
  const wrapper = (binOrDV, initialOffset=0, ...args) => {
    const target = new Class(...args);
    target._dv = (binOrDV instanceof DataView)
      ? binOrDV
      : new DataView(binOrDV);
    target._initialOffset = initialOffset;

    // Get a single byte (as unsigned integer) from a position
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

  // Array creator helper
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
