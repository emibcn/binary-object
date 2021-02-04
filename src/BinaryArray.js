class BinaryArrayBase {
  type;
  dv;
  offset;
  length;
  bytes;

  constructor(dv, type, offset, length) {
    this.type   = type;
    this.dv     = dv;
    this.offset = offset;
    this.length = length;
    this.bytes  = length * type.bytes;
  }

  // Proxy array methods using this iterator
  map = (fn) => Array.from(this, fn);
  //reduce = (...args) => Array.prototype.reduce.call([...this], ...args);
  toJSON = () => JSON.parse(JSON.stringify( this.map() ));

  // Make a generator iterator
  *[Symbol.iterator]() {
    // Deconstruct to optimize and ease reading
    const {length, dv, offset, type: {get, bytes} } = this;

    // Use a new index for each iterator. This makes multiple
    // iterations over the iterable safe for non-trivial cases,
    // such as use of break or nested looping over the same iterable.
    for(let index = 0; index < length; index++) {
      yield get(
          dv,
          offset + (bytes * index)
        )
    }
  }
}

const BinaryArrayHandler = {
  get(target, prop) {
    // Very inefficient way
    // Need to:
    //  - Override Array internals, but are private
    //  - Override `[]` operator, but it's not possible
    if (prop === '0' || (
          typeof prop === 'string' &&
          Number(prop) > 0
       )
    ) {
      // Destructure to optimize
      const {dv, offset, type: {get, bytes}} = target;
      return get(
        dv,
        offset + (bytes * Number(prop))
      )
    }

    // Return original value
    return Reflect.get(target, prop);
  },
  set(target, prop, value) {
    if (prop === '0' || (
          typeof prop === 'string' &&
          Number(prop) > 0
       )
    ) {
      // Destructure to optimize
      const {dv, offset, type: {set, bytes}} = target;
      set(
        dv,
        offset + (bytes * prop),
        value
      );
      return true;
    }
    return Reflect.get(target, prop, value);
  },
}

// #TODO: BUG: Argument Spread Operator not working
//             well when packing with webpack
const BinaryArray = (dv, type, offset, length) => {
  return new Proxy(
    new BinaryArrayBase(dv, type, offset, length),
    BinaryArrayHandler
  );
}

export default BinaryArray;
