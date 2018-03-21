
export default class Flatbush {

    constructor(numItems, nodeSize, ArrayType, data) {
        if (numItems === undefined) throw new Error('Missing required argument: numItems.');

        this.numItems = numItems;
        this.nodeSize = nodeSize || 16;
        this.ArrayType = ArrayType || Float64Array;

        // calculate the total number of nodes in the R-tree to allocate space for
        // and the index of each tree level (used in search later)
        var n = numItems;
        var numNodes = n;
        this._levelBounds = [n * 5];
        do {
            n = Math.ceil(n / this.nodeSize);
            numNodes += n;
            this._levelBounds.push(numNodes * 5);
        } while (n !== 1);

        if (data) {
            if (!(data instanceof ArrayBuffer))
                throw new Error('Data argument must be an instance of ArrayBuffer.');

            this.data = new this.ArrayType(data);
            this._numAdded = numItems;
            this._pos = numNodes * 5;
            this.minX = this.data[this._pos - 4];
            this.minY = this.data[this._pos - 3];
            this.maxX = this.data[this._pos - 2];
            this.maxY = this.data[this._pos - 1];

        } else {
            this.data = new this.ArrayType(numNodes * 5);
            this._numAdded = 0;
            this._pos = 0;
            this.minX = Infinity;
            this.minY = Infinity;
            this.maxX = -Infinity;
            this.maxY = -Infinity;
        }
    }

    add(minX, minY, maxX, maxY) {
        this.data[this._pos++] = this._numAdded++;
        this.data[this._pos++] = minX;
        this.data[this._pos++] = minY;
        this.data[this._pos++] = maxX;
        this.data[this._pos++] = maxY;

        if (minX < this.minX) this.minX = minX;
        if (minY < this.minY) this.minY = minY;
        if (maxX > this.maxX) this.maxX = maxX;
        if (maxY > this.maxY) this.maxY = maxY;
    }

    finish() {
        if (this._numAdded !== this.numItems) {
            throw new Error('Added ' + this._numAdded + ' items when expected ' + this.numItems);
        }

        var width = this.maxX - this.minX;
        var height = this.maxY - this.minY;
        var hilbertValues = new Uint32Array(this.numItems);
        var hilbertMax = (1 << 16) - 1;

        // map item coordinates into Hilbert coordinate space and calculate Hilbert values
        for (var i = 0; i < this.numItems; i++) {
            var x = Math.floor(hilbertMax * (this.data[5 * i + 1] - this.minX) / width);
            var y = Math.floor(hilbertMax * (this.data[5 * i + 2] - this.minY) / height);
            hilbertValues[i] = hilbert(x, y);
        }

        // sort items by their Hilbert value (for packing later)
        sort(hilbertValues, this.data, 0, this.numItems - 1);

        var pos = 0; // cursor for reading child nodes
        var numNodes = this.numItems;
        do {
            // generate nodes at the next tree level, bottom-up
            var end = pos + 5 * numNodes;
            numNodes = Math.ceil(numNodes / this.nodeSize);

            // generate a parent node for each block of consecutive <nodeSize> nodes
            while (pos < end) {
                var nodeMinX = Infinity;
                var nodeMinY = Infinity;
                var nodeMaxX = -Infinity;
                var nodeMaxY = -Infinity;
                var nodeIndex = pos;

                // calculate bbox for the new node
                for (i = 0; i < this.nodeSize && pos < end; i++) {
                    pos++; // skip index
                    var minX = this.data[pos++];
                    var minY = this.data[pos++];
                    var maxX = this.data[pos++];
                    var maxY = this.data[pos++];
                    if (minX < nodeMinX) nodeMinX = minX;
                    if (minY < nodeMinY) nodeMinY = minY;
                    if (maxX > nodeMaxX) nodeMaxX = maxX;
                    if (maxY > nodeMaxY) nodeMaxY = maxY;
                }

                // add the new node to the tree data
                this.data[this._pos++] = nodeIndex;
                this.data[this._pos++] = nodeMinX;
                this.data[this._pos++] = nodeMinY;
                this.data[this._pos++] = nodeMaxX;
                this.data[this._pos++] = nodeMaxY;
            }

        } while (numNodes !== 1);
    }

    search(minX, minY, maxX, maxY, filterFn) {
        if (this._levelBounds[0] === 0) {
            throw new Error('Data not yet indexed - call index.finish().');
        }

        var nodeIndex = this.data.length - 5;
        var queue = [];
        var results = [];

        while (nodeIndex !== undefined) {
            // find the bounds of the current tree level
            var end = upperBound(nodeIndex, this._levelBounds);

            // search through child nodes
            for (var i = 0; i < this.nodeSize; i++) {
                var pos = nodeIndex + 5 * i;

                // stop if we reached the end of the tree level
                if (i > 0 && pos >= end) break;

                var index = this.data[pos++];

                // check if node bbox intersects with query bbox
                if (maxX < this.data[pos++]) continue; // maxX < nodeMinX
                if (maxY < this.data[pos++]) continue; // maxY < nodeMinY
                if (minX > this.data[pos++]) continue; // minX > nodeMaxX
                if (minY > this.data[pos++]) continue; // minY > nodeMaxY

                if (nodeIndex < this.numItems * 5) {
                    // leaf item
                    var add = true;
                    if (filterFn !== undefined) add = filterFn(index);
                    if (add) results.push(index);

                } else {
                    queue.push(index); // node; add it to the search queue
                }
            }

            nodeIndex = queue.pop();
        }

        return results;
    }
}

// binary search for the first value in the array bigger than the given
function upperBound(value, arr) {
    var i = 0;
    var j = arr.length - 1;
    while (i < j) {
        var m = (i + j) >> 1;
        if (arr[m] > value) {
            j = m;
        } else {
            i = m + 1;
        }
    }
    return arr[i];
}

// custom quicksort that sorts bbox data alongside the hilbert values
function sort(values, boxes, left, right) {
    if (left >= right) return;

    var pivot = values[(left + right) >> 1];
    var i = left - 1;
    var j = right + 1;

    while (true) {
        do i++; while (values[i] < pivot);
        do j--; while (values[j] > pivot);
        if (i >= j) break;
        swap(values, boxes, i, j);
    }

    sort(values, boxes, left, j);
    sort(values, boxes, j + 1, right);
}

// swap two values and two corresponding boxes
function swap(values, boxes, i, j) {
    var temp = values[i];
    values[i] = values[j];
    values[j] = temp;

    var k = 5 * i;
    var m = 5 * j;

    var a = boxes[k];
    var b = boxes[k + 1];
    var c = boxes[k + 2];
    var d = boxes[k + 3];
    var e = boxes[k + 4];
    boxes[k] = boxes[m];
    boxes[k + 1] = boxes[m + 1];
    boxes[k + 2] = boxes[m + 2];
    boxes[k + 3] = boxes[m + 3];
    boxes[k + 4] = boxes[m + 4];
    boxes[m] = a;
    boxes[m + 1] = b;
    boxes[m + 2] = c;
    boxes[m + 3] = d;
    boxes[m + 4] = e;
}

// Fast Hilbert curve algorithm by http://threadlocalmutex.com/
// Ported from C++ https://github.com/rawrunprotected/hilbert_curves (public domain)
function hilbert(x, y) {
    var a = x ^ y;
    var b = 0xFFFF ^ a;
    var c = 0xFFFF ^ (x | y);
    var d = x & (y ^ 0xFFFF);

    var A = a | (b >> 1);
    var B = (a >> 1) ^ a;
    var C = ((c >> 1) ^ (b & (d >> 1))) ^ c;
    var D = ((a & (c >> 1)) ^ (d >> 1)) ^ d;

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

    var i0 = x ^ y;
    var i1 = b | (0xFFFF ^ (i0 | a));

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
