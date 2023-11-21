import FlatQueue from 'flatqueue';

const ARRAY_TYPES = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
const VERSION = 3; // serialized format version

/** @typedef {Int8ArrayConstructor | Uint8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor} TypedArrayConstructor */

export default class Flatbush {

    /**
     * Recreate a Flatbush index from raw `ArrayBuffer` or `SharedArrayBuffer` data.
     * @param {ArrayBuffer | SharedArrayBuffer} data
     * @returns {Flatbush} index
     */
    static from(data) {
        // @ts-expect-error duck typing array buffers
        if (!data || data.byteLength === undefined || data.buffer) {
            throw new Error('Data must be an instance of ArrayBuffer or SharedArrayBuffer.');
        }
        const [magic, versionAndType] = new Uint8Array(data, 0, 2);
        if (magic !== 0xfb) {
            throw new Error('Data does not appear to be in a Flatbush format.');
        }
        const version = versionAndType >> 4;
        if (version !== VERSION) {
            throw new Error(`Got v${version} data when expected v${VERSION}.`);
        }
        const ArrayType = ARRAY_TYPES[versionAndType & 0x0f];
        if (!ArrayType) {
            throw new Error('Unrecognized array type.');
        }
        const [nodeSize] = new Uint16Array(data, 2, 1);
        const [numItems] = new Uint32Array(data, 4, 1);

        return new Flatbush(numItems, nodeSize, ArrayType, undefined, data);
    }

    /**
     * Create a Flatbush index that will hold a given number of items.
     * @param {number} numItems
     * @param {number} [nodeSize=16] Size of the tree node (16 by default).
     * @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
     * @param {ArrayBufferConstructor | SharedArrayBufferConstructor} [ArrayBufferType=ArrayBuffer] The array buffer type used to store data (`ArrayBuffer` by default).
     * @param {ArrayBuffer | SharedArrayBuffer} [data] (Only used internally)
     */
    constructor(numItems, nodeSize = 16, ArrayType = Float64Array, ArrayBufferType = ArrayBuffer, data) {
        this.init(numItems, nodeSize, ArrayType, ArrayBufferType, data);
    }

    /**
     * Create a Flatbush index that will hold a given number of items.
     * @param {number} numItems
     * @param {number} [nodeSize=16] Size of the tree node (16 by default).
     * @param {TypedArrayConstructor} [ArrayType=Float64Array] The array type used for coordinates storage (`Float64Array` by default).
     * @param {ArrayBufferConstructor | SharedArrayBufferConstructor} [ArrayBufferType=ArrayBuffer] The array buffer type used to store data (`ArrayBuffer` by default).
     * @param {ArrayBuffer | SharedArrayBuffer} [data] (Only used internally)
     */
    init(numItems, nodeSize = 16, ArrayType = Float64Array, ArrayBufferType = ArrayBuffer, data) {
        if (numItems === undefined) throw new Error('Missing required argument: numItems.');
        if (isNaN(numItems) || numItems <= 0) throw new Error(`Unexpected numItems value: ${numItems}.`);

        this.numItems = +numItems;
        this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);

        // calculate the total number of nodes in the R-tree to allocate space for
        // and the index of each tree level (used in search later)
        let n = numItems;
        let numNodes = n;
        this._levelBounds = [n * 4];
        do {
            n = Math.ceil(n / this.nodeSize);
            numNodes += n;
            this._levelBounds.push(numNodes * 4);
        } while (n !== 1);

        this.ArrayType = ArrayType;
        this.IndexArrayType = numNodes < 16384 ? Uint16Array : Uint32Array;

        const arrayTypeIndex = ARRAY_TYPES.indexOf(this.ArrayType);
        const nodesByteSize = numNodes * 4 * this.ArrayType.BYTES_PER_ELEMENT;

        if (arrayTypeIndex < 0) {
            throw new Error(`Unexpected typed array class: ${ArrayType}.`);
        }

        // @ts-expect-error duck typing array buffers
        if (data && data.byteLength !== undefined && !data.buffer) {
            this.data = data;
            this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
            this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);

            this._pos = numNodes * 4;
            this.minX = this._boxes[this._pos - 4];
            this.minY = this._boxes[this._pos - 3];
            this.maxX = this._boxes[this._pos - 2];
            this.maxY = this._boxes[this._pos - 1];

        } else {
            this.data = new ArrayBufferType(8 + nodesByteSize + numNodes * this.IndexArrayType.BYTES_PER_ELEMENT);
            this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
            this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);
            this._pos = 0;
            this.minX = Infinity;
            this.minY = Infinity;
            this.maxX = -Infinity;
            this.maxY = -Infinity;

            new Uint8Array(this.data, 0, 2).set([0xfb, (VERSION << 4) + arrayTypeIndex]);
            new Uint16Array(this.data, 2, 1)[0] = nodeSize;
            new Uint32Array(this.data, 4, 1)[0] = numItems;
        }

        // a priority queue for k-nearest-neighbors queries
        /** @type FlatQueue<number> */
        this._queue = new FlatQueue();
    }

    /**
     * Trim index to number of added rectangles.
     */
    trim() {
        const {_boxes, _indices, _pos, minX, minY, maxX, maxY, nodeSize, ArrayType} = this;
        const numAdded = _pos >> 2;

        if (numAdded < this.numItems) {
            this.init(numAdded, nodeSize, ArrayType, this.data.constructor);

            this._pos = _pos;
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;

            this._boxes.set(_boxes.slice(0, this._boxes.length));
            this._indices.set(_indices.slice(0, this._indices.length));
        }
    }

    /**
     * Add a given rectangle to the index.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @returns {number} A zero-based, incremental number that represents the newly added rectangle.
     */
    add(minX, minY, maxX, maxY) {
        const index = this._pos >> 2;
        const boxes = this._boxes;
        this._indices[index] = index;
        boxes[this._pos++] = minX;
        boxes[this._pos++] = minY;
        boxes[this._pos++] = maxX;
        boxes[this._pos++] = maxY;

        if (minX < this.minX) this.minX = minX;
        if (minY < this.minY) this.minY = minY;
        if (maxX > this.maxX) this.maxX = maxX;
        if (maxY > this.maxY) this.maxY = maxY;

        return index;
    }

    /**
     * Perform indexing of the added rectangles.
     * @param {boolean} trim Whether to auto-trim index when number of added rectangles is less than numItems (`false` by default).
    */
    finish(trim = false) {
        const numAdded = this._pos >> 2;

        if (numAdded < this.numItems && trim) {
            this.trim();
        } else if (numAdded !== this.numItems) {
            throw new Error(`Added ${numAdded} items when expected ${this.numItems}.`);
        }

        const boxes = this._boxes;

        if (this.numItems <= this.nodeSize) {
            // only one node, skip sorting and just fill the root box
            boxes[this._pos++] = this.minX;
            boxes[this._pos++] = this.minY;
            boxes[this._pos++] = this.maxX;
            boxes[this._pos++] = this.maxY;
            return;
        }

        const width = (this.maxX - this.minX) || 1;
        const height = (this.maxY - this.minY) || 1;
        const hilbertValues = new Uint32Array(this.numItems);
        const hilbertMax = (1 << 16) - 1;

        // map item centers into Hilbert coordinate space and calculate Hilbert values
        for (let i = 0, pos = 0; i < this.numItems; i++) {
            const minX = boxes[pos++];
            const minY = boxes[pos++];
            const maxX = boxes[pos++];
            const maxY = boxes[pos++];
            const x = Math.floor(hilbertMax * ((minX + maxX) / 2 - this.minX) / width);
            const y = Math.floor(hilbertMax * ((minY + maxY) / 2 - this.minY) / height);
            hilbertValues[i] = hilbert(x, y);
        }

        // sort items by their Hilbert value (for packing later)
        sort(hilbertValues, boxes, this._indices, 0, this.numItems - 1, this.nodeSize);

        // generate nodes at each tree level, bottom-up
        for (let i = 0, pos = 0; i < this._levelBounds.length - 1; i++) {
            const end = this._levelBounds[i];

            // generate a parent node for each block of consecutive <nodeSize> nodes
            while (pos < end) {
                const nodeIndex = pos;

                // calculate bbox for the new node
                let nodeMinX = boxes[pos++];
                let nodeMinY = boxes[pos++];
                let nodeMaxX = boxes[pos++];
                let nodeMaxY = boxes[pos++];
                for (let j = 1; j < this.nodeSize && pos < end; j++) {
                    nodeMinX = Math.min(nodeMinX, boxes[pos++]);
                    nodeMinY = Math.min(nodeMinY, boxes[pos++]);
                    nodeMaxX = Math.max(nodeMaxX, boxes[pos++]);
                    nodeMaxY = Math.max(nodeMaxY, boxes[pos++]);
                }

                // add the new node to the tree data
                this._indices[this._pos >> 2] = nodeIndex;
                boxes[this._pos++] = nodeMinX;
                boxes[this._pos++] = nodeMinY;
                boxes[this._pos++] = nodeMaxX;
                boxes[this._pos++] = nodeMaxY;
            }
        }
    }

    /**
     * Search the index by a bounding box.
     * @param {number} minX
     * @param {number} minY
     * @param {number} maxX
     * @param {number} maxY
     * @param {(index: number) => boolean} [filterFn] An optional function for filtering the results.
     * @returns {number[]} An array of indices of items intersecting or touching the given bounding box.
     */
    search(minX, minY, maxX, maxY, filterFn) {
        if (this._pos !== this._boxes.length) {
            throw new Error('Data not yet indexed - call index.finish().');
        }

        /** @type number | undefined */
        let nodeIndex = this._boxes.length - 4;
        const queue = [];
        const results = [];

        while (nodeIndex !== undefined) {
            // find the end index of the node
            const end = Math.min(nodeIndex + this.nodeSize * 4, upperBound(nodeIndex, this._levelBounds));

            // search through child nodes
            for (let /** @type number */ pos = nodeIndex; pos < end; pos += 4) {
                // check if node bbox intersects with query bbox
                if (maxX < this._boxes[pos]) continue; // maxX < nodeMinX
                if (maxY < this._boxes[pos + 1]) continue; // maxY < nodeMinY
                if (minX > this._boxes[pos + 2]) continue; // minX > nodeMaxX
                if (minY > this._boxes[pos + 3]) continue; // minY > nodeMaxY

                const index = this._indices[pos >> 2] | 0;

                if (nodeIndex >= this.numItems * 4) {
                    queue.push(index); // node; add it to the search queue

                } else if (filterFn === undefined || filterFn(index)) {
                    results.push(index); // leaf item
                }
            }

            nodeIndex = queue.pop();
        }

        return results;
    }

    /**
     * Search items in order of distance from the given point.
     * @param {number} x
     * @param {number} y
     * @param {number} [maxResults=Infinity]
     * @param {number} [maxDistance=Infinity]
     * @param {(index: number) => boolean} [filterFn] An optional function for filtering the results.
     * @returns {number[]} An array of indices of items found.
     */
    neighbors(x, y, maxResults = Infinity, maxDistance = Infinity, filterFn) {
        if (this._pos !== this._boxes.length) {
            throw new Error('Data not yet indexed - call index.finish().');
        }

        /** @type number | undefined */
        let nodeIndex = this._boxes.length - 4;
        const q = this._queue;
        const results = [];
        const maxDistSquared = maxDistance * maxDistance;

        outer: while (nodeIndex !== undefined) {
            // find the end index of the node
            const end = Math.min(nodeIndex + this.nodeSize * 4, upperBound(nodeIndex, this._levelBounds));

            // add child nodes to the queue
            for (let pos = nodeIndex; pos < end; pos += 4) {
                const index = this._indices[pos >> 2] | 0;

                const dx = axisDist(x, this._boxes[pos], this._boxes[pos + 2]);
                const dy = axisDist(y, this._boxes[pos + 1], this._boxes[pos + 3]);
                const dist = dx * dx + dy * dy;
                if (dist > maxDistSquared) continue;

                if (nodeIndex >= this.numItems * 4) {
                    q.push(index << 1, dist); // node (use even id)

                } else if (filterFn === undefined || filterFn(index)) {
                    q.push((index << 1) + 1, dist); // leaf item (use odd id)
                }
            }

            // pop items from the queue
            // @ts-expect-error q.length check eliminates undefined values
            while (q.length && (q.peek() & 1)) {
                const dist = q.peekValue();
                // @ts-expect-error
                if (dist > maxDistSquared) break outer;
                // @ts-expect-error
                results.push(q.pop() >> 1);
                if (results.length === maxResults) break outer;
            }

            // @ts-expect-error
            nodeIndex = q.length ? q.pop() >> 1 : undefined;
        }

        q.clear();
        return results;
    }
}

/**
 * 1D distance from a value to a range.
 * @param {number} k
 * @param {number} min
 * @param {number} max
 */
function axisDist(k, min, max) {
    return k < min ? min - k : k <= max ? 0 : k - max;
}

/**
 * Binary search for the first value in the array bigger than the given.
 * @param {number} value
 * @param {number[]} arr
 */
function upperBound(value, arr) {
    let i = 0;
    let j = arr.length - 1;
    while (i < j) {
        const m = (i + j) >> 1;
        if (arr[m] > value) {
            j = m;
        } else {
            i = m + 1;
        }
    }
    return arr[i];
}

/**
 * Custom quicksort that partially sorts bbox data alongside the hilbert values.
 * @param {Uint32Array} values
 * @param {InstanceType<TypedArrayConstructor>} boxes
 * @param {Uint16Array | Uint32Array} indices
 * @param {number} left
 * @param {number} right
 * @param {number} nodeSize
 */
function sort(values, boxes, indices, left, right, nodeSize) {
    if (Math.floor(left / nodeSize) >= Math.floor(right / nodeSize)) return;

    const pivot = values[(left + right) >> 1];
    let i = left - 1;
    let j = right + 1;

    while (true) {
        do i++; while (values[i] < pivot);
        do j--; while (values[j] > pivot);
        if (i >= j) break;
        swap(values, boxes, indices, i, j);
    }

    sort(values, boxes, indices, left, j, nodeSize);
    sort(values, boxes, indices, j + 1, right, nodeSize);
}

/**
 * Swap two values and two corresponding boxes.
 * @param {Uint32Array} values
 * @param {InstanceType<TypedArrayConstructor>} boxes
 * @param {Uint16Array | Uint32Array} indices
 * @param {number} i
 * @param {number} j
 */
function swap(values, boxes, indices, i, j) {
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;

    const k = 4 * i;
    const m = 4 * j;

    const a = boxes[k];
    const b = boxes[k + 1];
    const c = boxes[k + 2];
    const d = boxes[k + 3];
    boxes[k] = boxes[m];
    boxes[k + 1] = boxes[m + 1];
    boxes[k + 2] = boxes[m + 2];
    boxes[k + 3] = boxes[m + 3];
    boxes[m] = a;
    boxes[m + 1] = b;
    boxes[m + 2] = c;
    boxes[m + 3] = d;

    const e = indices[i];
    indices[i] = indices[j];
    indices[j] = e;
}

/**
 * Fast Hilbert curve algorithm by http://threadlocalmutex.com/
 * Ported from C++ https://github.com/rawrunprotected/hilbert_curves (public domain)
 * @param {number} x
 * @param {number} y
 */
function hilbert(x, y) {
    let a = x ^ y;
    let b = 0xFFFF ^ a;
    let c = 0xFFFF ^ (x | y);
    let d = x & (y ^ 0xFFFF);

    let A = a | (b >> 1);
    let B = (a >> 1) ^ a;
    let C = ((c >> 1) ^ (b & (d >> 1))) ^ c;
    let D = ((a & (c >> 1)) ^ (d >> 1)) ^ d;

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 2)) ^ (b & (b >> 2)));
    B = ((a & (b >> 2)) ^ (b & ((a ^ b) >> 2)));
    C ^= ((a & (c >> 2)) ^ (b & (d >> 2)));
    D ^= ((b & (c >> 2)) ^ ((a ^ b) & (d >> 2)));

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 4)) ^ (b & (b >> 4)));
    B = ((a & (b >> 4)) ^ (b & ((a ^ b) >> 4)));
    C ^= ((a & (c >> 4)) ^ (b & (d >> 4)));
    D ^= ((b & (c >> 4)) ^ ((a ^ b) & (d >> 4)));

    a = A; b = B; c = C; d = D;
    C ^= ((a & (c >> 8)) ^ (b & (d >> 8)));
    D ^= ((b & (c >> 8)) ^ ((a ^ b) & (d >> 8)));

    a = C ^ (C >> 1);
    b = D ^ (D >> 1);

    let i0 = x ^ y;
    let i1 = b | (0xFFFF ^ (i0 | a));

    i0 = (i0 | (i0 << 8)) & 0x00FF00FF;
    i0 = (i0 | (i0 << 4)) & 0x0F0F0F0F;
    i0 = (i0 | (i0 << 2)) & 0x33333333;
    i0 = (i0 | (i0 << 1)) & 0x55555555;

    i1 = (i1 | (i1 << 8)) & 0x00FF00FF;
    i1 = (i1 | (i1 << 4)) & 0x0F0F0F0F;
    i1 = (i1 | (i1 << 2)) & 0x33333333;
    i1 = (i1 | (i1 << 1)) & 0x55555555;

    return ((i1 << 1) | i0) >>> 0;
}
