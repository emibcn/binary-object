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

    // Get this poroperty offset
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
// JS class syntax benefits if using withBinary, don't use `extend Binary`
// and don't use `new` either.
const withBinary = (Class) => {
  const wrapper = (binOrDV, initialOffset=0, ...args) => {
    const target = new Class(...args);
    target._dv = (binOrDV instanceof DataView)
      ? binOrDV
      : new DataView(binOrDV);
    target._initialOffset = initialOffset;

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

  // Allow getting the class size from outside (as static)
  Object.defineProperty(wrapper, 'binarySize', {
    get() { return Class._size },
    configurable: false,
    enumerable: false,
  });

  return wrapper;
}

export {withBinary, binary};
