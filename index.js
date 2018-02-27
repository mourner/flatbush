'use strict';

module.exports = flatbush;

function flatbush(numItems, nodeSize) {
    return new Flatbush(numItems, nodeSize);
}

function Flatbush(numItems, nodeSize) {

    if (numItems === undefined) throw new Error('Missign constructor argument: numItems.');

    this._numItems = numItems;
    this._nodeSize = nodeSize || 16;

    // calculate the total number of nodes in the R-tree to allocate space for
    var n = numItems;
    var numNodes = n;
    var numLevels = 1;
    do {
        n = Math.ceil(n / this._nodeSize);
        numNodes += n;
        numLevels++;
    } while (n !== 1);

    this.data = new Float64Array(numNodes * 5);
    this._hilbertValues = new Uint32Array(numItems);
    this._levelBoundaries = new Uint32Array(numLevels);

    this._numAdded = 0;
    this._pos = 0;

    this._minX = Infinity;
    this._minY = Infinity;
    this._maxX = -Infinity;
    this._maxY = -Infinity;
}

Flatbush.prototype = {
    add: function (minX, minY, maxX, maxY) {
        this.data[this._pos++] = this._numAdded++;
        this.data[this._pos++] = minX;
        this.data[this._pos++] = minY;
        this.data[this._pos++] = maxX;
        this.data[this._pos++] = maxY;

        if (minX < this._minX) this._minX = minX;
        if (minY < this._minY) this._minY = minY;
        if (maxX > this._maxX) this._maxX = maxX;
        if (maxY > this._maxY) this._maxY = maxY;
    },

    finish: function () {
        if (this._numAdded !== this._numItems) {
            throw new Error('The number of items added does not match the number in the constructor.');
        }

        var width = this._maxX - this._minX;
        var height = this._maxY - this._minY;
        var hilbertMax = (1 << 16) - 1;

        // map item coordinates into Hilbert coordinate space and calculate Hilbert values
        for (var i = 0; i < this._numItems; i++) {
            var x = Math.floor(hilbertMax * this.data[5 * i + 1] / width);
            var y = Math.floor(hilbertMax * this.data[5 * i + 2] / height);
            this._hilbertValues[i] = hilbert(x, y);
        }

        // sort items by their Hilbert value (for packing later)
        sort(this._hilbertValues, this.data, 0, this._numItems - 1);

        var pos = 0; // cursor for reading child nodes
        var numNodes = this._numItems;
        var level = 0;

        do {
            // generate nodes at the next tree level, bottom-up
            var end = pos + 5 * numNodes;
            numNodes = Math.ceil(numNodes / this._nodeSize);

            // mark the start of a new tree level (for checks during search)
            this._levelBoundaries[level++] = this._pos;

            // generate a parent node for each block of consecutive <nodeSize> nodes
            while (pos < end) {
                var nodeMinX = Infinity;
                var nodeMinY = Infinity;
                var nodeMaxX = -Infinity;
                var nodeMaxY = -Infinity;
                var nodeIndex = pos;

                // calculate bbox for the new node
                for (i = 0; i < this._nodeSize && pos < end; i++) {
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

        this._levelBoundaries[level++] = this._pos;
    },

    search: function (minX, minY, maxX, maxY, visitFn) {
        var nodeIndex = this.data.length - 5;
        var queue = [];

        while (nodeIndex !== undefined) {
            // find the bounds of the current tree level
            var end;
            for (var i = 0; i < this._levelBoundaries.length; i++) {
                end = this._levelBoundaries[i];
                if (end > nodeIndex) break;
            }

            // search through child nodes
            for (i = 0; i < this._nodeSize; i++) {
                var pos = nodeIndex + 5 * i;

                // stop if we reached the end of the tree level
                if (i > 0 && pos >= end) break;

                var index = this.data[pos++];

                // check if node bbox intersects with query bbox
                if (maxX < this.data[pos++]) continue; // maxX < nodeMinX
                if (maxY < this.data[pos++]) continue; // maxY < nodeMinY
                if (minX > this.data[pos++]) continue; // minX > nodeMaxX
                if (minY > this.data[pos++]) continue; // minY > nodeMaxY

                if (nodeIndex < this._numItems * 5) {
                    visitFn(index); // leaf item

                } else {
                    queue.push(index); // node; add it to the search queue
                }
            }

            nodeIndex = queue.pop();
        }
    }
};

// custom quicksort that sorts bbox data alongside the hilbert values
function sort(values, boxes, left, right) {
    if (left >= right) return;

    var i = left + 1;
    var j = right;

    swap(values, boxes, (left + right) >> 1, i);
    if (values[left] > values[right]) swap(values, boxes, left, right);
    if (values[i] > values[right]) swap(values, boxes, i, right);
    if (values[left] > values[i]) swap(values, boxes, left, i);

    var temp = values[i];
    while (true) {
        do i++; while (values[i] < temp);
        do j--; while (values[j] > temp);
        if (j < i) break;
        swap(values, boxes, i, j);
    }
    values[left + 1] = values[j];
    values[j] = temp;

    if (right - i + 1 >= j - left) {
        sort(values, boxes, i, right);
        sort(values, boxes, left, j - 1);
    } else {
        sort(values, boxes, left, j - 1);
        sort(values, boxes, i, right);
    }
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
