// Not efficient enough...
import { nonenumerable } from 'core-decorators';

import Types from './Types';

class Binary {

  // TODO:
  //  - Handle Endianess
  //  - Handle Clamped

  // Class props
  // Slowers down 4x times...
  //@nonenumerable
  static _size;
  static get binarySize() { return this._size }

  //@nonenumerable
  static _binaryProps;
  //@nonenumerable
  static get binaryProps() { return this._binaryProps }

  //@nonenumerable
  static arrayFactory(binOrDV, length, initialOffset=0, list=[]) {
    // Optimize: Generate a single DataView for all elements
    const dv = binOrDV instanceof DataView
      ? binOrDV
      : new DataView(binOrDV, initialOffset, length * this._size)

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
  //@nonenumerable
  get _dv() {
    this.__dv = this?.__dv ?? new DataView(this._bin, this._initialOffset, this.constructor._size)
    return this.__dv
  };

  //@nonenumerable
  toJSON = () => this.constructor._binaryProps
    .reduce( (acc, prop) => ({
        ...acc,
        [prop]: this[prop],
      }),
      {},
    );

  // Instantiate own DataView and save own initial offset at binary data
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

  // Get a single byte (as unsigned integer) from a position
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
