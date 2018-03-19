
export default function flatbush(numItems, nodeSize, ArrayType) {
    return new Flatbush(numItems, nodeSize, ArrayType);
}

function Flatbush(numItems, nodeSize, ArrayType) {
    if (numItems === undefined) throw new Error('Missing required argument: numItems.');

    this._numItems = numItems;
    this._nodeSize = nodeSize || 16;
    ArrayType = ArrayType || Float64Array;

    // calculate the total number of nodes in the R-tree to allocate space for
    var n = numItems;
    var numNodes = n;
    var numLevels = 1;
    do {
        n = Math.ceil(n / this._nodeSize);
        numNodes += n;
        numLevels++;
    } while (n !== 1);

    this.data = new ArrayType(numNodes * 5);
    this._centers = new ArrayType(numNodes * 2);
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
            throw new Error('Added ' + this._numAdded + ' items when expected ' + this._numItems);
        }

        for (var i = 0; i < this._numItems; i++) {
            var k = 5 * i;
            this._centers[2 * i + 0] = (this.data[k + 3] + this.data[k + 1]) / 2;
            this._centers[2 * i + 1] = (this.data[k + 4] + this.data[k + 2]) / 2;
        }

        var pos = 0; // cursor for reading child nodes
        var numNodes = this._numItems;
        var level = 0;

        do {
            // generate nodes at the next tree level, bottom-up
            var numLeafNodes = Math.ceil(numNodes / this._nodeSize);
            var numVerticalSlices = Math.ceil(Math.sqrt(numLeafNodes));
            var sliceLen = numVerticalSlices * this._nodeSize;
            var start = pos / 5;

            // mark the start of a new tree level (for checks during search)
            this._levelBoundaries[level++] = this._pos;

            sort(this._centers, 0, this.data, start, start + numNodes - 1);

            for (i = start; i < start + numNodes; i += sliceLen) {
                var m = Math.min(start + numNodes, i + sliceLen) - 1;
                sort(this._centers, 1, this.data, i, m);

                // generate a parent node for each block of consecutive <nodeSize> nodes
                for (var j = i; j <= m; j += this._nodeSize) {
                    var nodeMinX = Infinity;
                    var nodeMinY = Infinity;
                    var nodeMaxX = -Infinity;
                    var nodeMaxY = -Infinity;
                    var nodeIndex = pos;

                    // calculate bbox for the new node
                    for (k = 0; k < this._nodeSize && j + k <= m; k++) {
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
            }

            numNodes = numLeafNodes;
        } while (numNodes !== 1);

        this._levelBoundaries[level++] = this._pos;
    },

    search: function (minX, minY, maxX, maxY, filterFn) {
        if (this._levelBoundaries[0] === 0) {
            throw new Error('Data not yet indexed - call index.finish().');
        }

        var nodeIndex = this.data.length - 5;
        var queue = [];
        var results = [];

        while (nodeIndex !== undefined) {
            // find the bounds of the current tree level
            var end = upperBound(nodeIndex, this._levelBoundaries);

            // search through child nodes
            for (var i = 0; i < this._nodeSize; i++) {
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
};

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

// custom quicksort that sorts bbox data alongside the center values
function sort(centers, axis, boxes, left, right) {
    if (left >= right) return;

    var m = (left + right) >> 1;
    var pivot = centers[2 * m + axis];
    var i = left - 1;
    var j = right + 1;

    while (true) {
        do i++; while (centers[2 * i + axis] < pivot);
        do j--; while (centers[2 * j + axis] > pivot);
        if (i >= j) break;
        swap(centers, boxes, i, j);
    }

    sort(centers, axis, boxes, left, j);
    sort(centers, axis, boxes, j + 1, right);
}

// swap two values and two corresponding boxes
function swap(centers, boxes, i, j) {
    var k = 2 * i;
    var m = 2 * j;
    var x = centers[k];
    var y = centers[k + 1];
    centers[k] = centers[m];
    centers[k + 1] = centers[m + 1];
    centers[m] = x;
    centers[m + 1] = y;

    k = 5 * i;
    m = 5 * j;

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
