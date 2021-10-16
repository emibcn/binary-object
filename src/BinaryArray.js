/** Class for returning array members from {@link Binary} objects */
class BinaryArrayBase {
  // @member
  type;
  // @member
  dv;
  // @member
  offset;
  // @member
  length;
  // @member
  bytes;

  /**
   * Creates a new customized array
   * @param {DataView} dv - The DataView handling the buffer where the data lives
   * @param {object} type - The type of the array members from {@link Types}
   * @param {number} offset - The offset of the first member of the array into the buffer
   * @param {number} length - The length of the array
   */
  constructor(dv, type, offset, length) {
    this.type = type;
    this.dv = dv;
    this.offset = offset;
    this.length = length;
    this.bytes = length * type.bytes;
  }

  /**
   * Proxy array methods using this iterator
   * @param {function} fn - The function to apply on the array elements
   * @return {array} - The new generated array (not bound to original values)
   * @method
   */
  map = (fn) => Array.from(this, fn);
  //reduce = (...args) => Array.prototype.reduce.call([...this], ...args);

  /**
   * Transform this array into a JSON string
   * @return {string} - The JSON string representing this array
   * @method
   */
  toJSON = () => JSON.parse(JSON.stringify(this.map()));

  /**
   * Make a generator iterator
   * @method
   * @generator
   * @function iterator
   * @yield {any} - Each of this array elements of type {@link Types}
   * @name iterator
   */
  *[Symbol.iterator]() {
    // Deconstruct to optimize and ease reading
    const {
      length,
      dv,
      offset,
      type: { get, bytes },
    } = this;

    // Use a new index for each iterator. This makes multiple
    // iterations over the iterable safe for non-trivial cases,
    // such as use of break or nested looping over the same iterable.
    for (let index = 0; index < length; index++) {
      yield get(dv, offset + bytes * index);
    }
  }
}

/**
 * A Proxy handler for the {@link BinaryArray} class to allow accessing its elements
 * @enum
 */
const BinaryArrayHandler = {
  /**
   * Getter for the elements of the handled {@link BinaryArray}
   * @param {BinaryArray} target - The handled {@link BinaryArray} instance
   * @param {string} prop - The property to return (only handled when prop is a string representing a number)
   * @return {any} - The element at {@link prop} position, or a reflected value from {@link target}
   */
  get(target, prop) {
    // Very inefficient way
    // Need to:
    //  - Override Array internals, but are private
    //  - Override `[]` operator, but it's not possible
    if (prop === "0" || (typeof prop === "string" && Number(prop) > 0)) {
      // Destructure to optimize
      const {
        dv,
        offset,
        type: { get, bytes },
      } = target;
      return get(dv, offset + bytes * Number(prop));
    }

    // Return original value
    return Reflect.get(target, prop);
  },

  /**
   * Setter for the elements of the handled {@link BinaryArray}
   * @param {BinaryArray} target - The handled {@link BinaryArray} instance
   * @param {string} prop - The property to set (only handled when prop is a string representing a number)
   * @param {any} value - The value to assign to the {@link prop}'th element
   * @return {boolean} - If {@link prop} is numericalish, true (as needed for JS setters), else the return value from the {@link target} reflected setter
   */
  set(target, prop, value) {
    if (prop === "0" || (typeof prop === "string" && Number(prop) > 0)) {
      // Destructure to optimize
      const {
        dv,
        offset,
        type: { set, bytes },
      } = target;
      set(dv, offset + bytes * Number(prop), value);
      return true;
    }
    return Reflect.set(target, prop, value);
  },
};

// #TODO: BUG: Argument Spread Operator not working
//             well when packing with webpack
/**
 * Proxy creator for {@link BinaryArrayBase}
 * @param {DataView} dv - The DataView handling the buffer where the data lives
 * @param {object} type - The type of the array members from {@link Types}
 * @param {number} offset - The offset before the first member of the array
 * @param {number} length - The length of the array
 * @return {Proxy} - The proxy to {@link BinaryArrayBase} with {@link BinaryArrayHandler} as proxy handler
 */
const BinaryArray = (dv, type, offset, length) => {
  return new Proxy(
    new BinaryArrayBase(dv, type, offset, length),
    BinaryArrayHandler
  );
};

export default BinaryArray;
