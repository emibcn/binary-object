// Not efficient enough...
import { nonenumerable } from 'core-decorators';

import Types from './Types';

/** Class allowing `@binary` members */
class Binary {

  // TODO:
  //  - Handle Endianess
  //  - Handle Clamped

  // Class props
  // Slowers down 4x times...
  //@nonenumerable
  static _size;
  /**
   * Static getter for the class binary size
   * @return {number} - The class binary size
   */
  static get binarySize() { return this._size }

  //@nonenumerable
  static _binaryProps;
  /**
   * Static getter for the class binary props
   * @return {array} - The list of binary props
   */
  static get binaryProps() { return this._binaryProps }

  /**
   * Fills an array with objects of this class using a unique buffer
   * @param {ArrayBuffer/SharedArrayBuffer/DataView} binOrDv - The buffer where the data lives
   * @param {number} length - The number of objects to add to the array
   * @param {number} initialOffset - Buffer offset before this object data start
   * @param {array} list - The array where new objects will be added
   * @return {array} - The array {@link list} where the objects have been added
   */
  //@nonenumerable
  static arrayFactory(binOrDV, length, initialOffset=0, list=[]) {
    // Optimize: Generate a single DataView for all elements
    const dv = binOrDV instanceof DataView
      ? binOrDV
      : new DataView(binOrDV)

    for(let i = 0; i < length; i++) {
      list.push(new this(dv, initialOffset + this._size * i));
    }

    return list
  }

  // Prototype props
  //@nonenumerable
  _initialOffset;
  //@nonenumerable
  _bin;
  //@nonenumerable
  __dv;
  /**
   * Getter of the DataView containing this object's data
   * @return {DataView} - The DataView
   */
  //@nonenumerable
  get _dv() {
    this.__dv = this?.__dv ?? new DataView(this._bin, this._initialOffset, this.constructor._size)
    return this.__dv
  };

  /**
   * Transform this object into a JSON string containing all the binary members
   * @return {string} - The JSON string
   * @method
   */
  //@nonenumerable
  toJSON = () => this.constructor._binaryProps
    .reduce( (acc, prop) => ({
        ...acc,
        [prop]: this[prop],
      }),
      {},
    );

  /**
   * Save own initial offset at binary data
   * @param {ArrayBuffer/SharedArrayBuffer/DataView} binOrDv - The buffer where the data lives
   * @param {number} initialOffset - Buffer offset before this object data start
   * @param {boolean} isLazy - If true and {@link binOrDv} is not a {DataView}, wait until first acces before Instantiating the __dv
   */
  constructor(binOrDV, initialOffset=0, isLazy=true) {
    this._initialOffset = initialOffset;
    if(binOrDV instanceof DataView) {
      this.__dv = binOrDV;
    }
    else {
      this._bin = binOrDV;
      if(!isLazy) {
        this._dv; // Call getter
      }
    }
  }

  /**
   * Get a single byte (as unsigned integer) from a position
   * @param {number} offset - The position of the byte to get
   * @return {number} - The unsigned numerical number at the specified position
   * @method
   */
  //@nonenumerable
  getByteAt = (offset) => Types.Uint8.get(this._dv, this._initialOffset + offset);
}

/*
Object.defineProperty(Binary, "_size", {
  enumerable: false,
  writable: true,
});
Object.defineProperty(Binary, "binarySize", {
  enumerable: false,
  get () { return this._size }
});

Object.defineProperty(Binary, "_binaryProps", {
  enumerable: false,
  writable: true,
});
Object.defineProperty(Binary, "binaryProps", {
  enumerable: false,
  get () { return this._binaryProps }
});
*/

export default Binary;
