
import Flatbush from './index.js';
import test from 'tape';

const data = [
    8, 62, 11, 66, 57, 17, 57, 19, 76, 26, 79, 29, 36, 56, 38, 56, 92, 77, 96, 80, 87, 70, 90, 74,
    43, 41, 47, 43, 0, 58, 2, 62, 76, 86, 80, 89, 27, 13, 27, 15, 71, 63, 75, 67, 25, 2, 27, 2, 87,
    6, 88, 6, 22, 90, 23, 93, 22, 89, 22, 93, 57, 11, 61, 13, 61, 55, 63, 56, 17, 85, 21, 87, 33,
    43, 37, 43, 6, 1, 7, 3, 80, 87, 80, 87, 23, 50, 26, 52, 58, 89, 58, 89, 12, 30, 15, 34, 32, 58,
    36, 61, 41, 84, 44, 87, 44, 18, 44, 19, 13, 63, 15, 67, 52, 70, 54, 74, 57, 59, 58, 59, 17, 90,
    20, 92, 48, 53, 52, 56, 92, 68, 92, 72, 26, 52, 30, 52, 56, 23, 57, 26, 88, 48, 88, 48, 66, 13,
    67, 15, 7, 82, 8, 86, 46, 68, 50, 68, 37, 33, 38, 36, 6, 15, 8, 18, 85, 36, 89, 38, 82, 45, 84,
    48, 12, 2, 16, 3, 26, 15, 26, 16, 55, 23, 59, 26, 76, 37, 79, 39, 86, 74, 90, 77, 16, 75, 18,
    78, 44, 18, 45, 21, 52, 67, 54, 71, 59, 78, 62, 78, 24, 5, 24, 8, 64, 80, 64, 83, 66, 55, 70,
    55, 0, 17, 2, 19, 15, 71, 18, 74, 87, 57, 87, 59, 6, 34, 7, 37, 34, 30, 37, 32, 51, 19, 53, 19,
    72, 51, 73, 55, 29, 45, 30, 45, 94, 94, 96, 95, 7, 22, 11, 24, 86, 45, 87, 48, 33, 62, 34, 65,
    18, 10, 21, 14, 64, 66, 67, 67, 64, 25, 65, 28, 27, 4, 31, 6, 84, 4, 85, 5, 48, 80, 50, 81, 1,
    61, 3, 61, 71, 89, 74, 92, 40, 42, 43, 43, 27, 64, 28, 66, 46, 26, 50, 26, 53, 83, 57, 87, 14,
    75, 15, 79, 31, 45, 34, 45, 89, 84, 92, 88, 84, 51, 85, 53, 67, 87, 67, 89, 39, 26, 43, 27, 47,
    61, 47, 63, 23, 49, 25, 53, 12, 3, 14, 5, 16, 50, 19, 53, 63, 80, 64, 84, 22, 63, 22, 64, 26,
    66, 29, 66, 2, 15, 3, 15, 74, 77, 77, 79, 64, 11, 68, 11, 38, 4, 39, 8, 83, 73, 87, 77, 85, 52,
    89, 56, 74, 60, 76, 63, 62, 66, 65, 67
];

function createIndex() {
    const index = new Flatbush(data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
        index.add(data[i], data[i + 1], data[i + 2], data[i + 3]);
    }
    index.finish();

    return index;
}

function createSmallIndex(numItems, nodeSize) {
    const index = new Flatbush(numItems, nodeSize);
    for (let i = 0; i < 4 * numItems; i += 4) {
        index.add(data[i], data[i + 1], data[i + 2], data[i + 3]);
    }
    index.finish();
    return index;
}


test('indexes a bunch of rectangles', (t) => {
    const index = createIndex();

    const len = index._boxes.length;
    t.equal(index._boxes.length + index._indices.length, 540);
    t.same(Array.from(index._boxes.subarray(len - 4, len)), [0, 1, 96, 95]);
    t.same(index._indices[len / 4 - 1], 400);

    t.end();
});

test('skips sorting less than nodeSize number of rectangles', (t) => {
    const numItems = 14;
    const nodeSize = 16;
    const index = createSmallIndex(numItems, nodeSize);

    // compute expected root box extents
    let rootXMin = Infinity;
    let rootYMin = Infinity;
    let rootXMax = -Infinity;
    let rootYMax = -Infinity;
    for (let i = 0; i < 4 * numItems; i += 4) {
        if (data[i] < rootXMin) rootXMin = data[i];
        if (data[i + 1] < rootYMin) rootYMin = data[i + 1];
        if (data[i + 2] > rootXMax) rootXMax = data[i + 2];
        if (data[i + 3] > rootYMax) rootYMax = data[i + 3];
    }

    // sort should be skipped, ordered progressing indices expected
    const expectedIndices = [];
    for (let i = 0; i < numItems; ++i) {
        expectedIndices.push(i);
    }
    expectedIndices.push(0);

    const len = index._boxes.length;

    t.same(Array.from(index._indices), expectedIndices);
    t.equal(len, (numItems + 1) * 4);
    t.same(Array.from(index._boxes.subarray(len - 4, len)), [rootXMin, rootYMin, rootXMax, rootYMax]);

    t.end();
});

test('performs bbox search', (t) => {
    const index = createIndex();

    const ids = index.search(40, 40, 60, 60);

    const results = [];
    for (let i = 0; i < ids.length; i++) {
        results.push(data[4 * ids[i]]);
        results.push(data[4 * ids[i] + 1]);
        results.push(data[4 * ids[i] + 2]);
        results.push(data[4 * ids[i] + 3]);
    }

    t.same(results.sort(compare), [57, 59, 58, 59, 48, 53, 52, 56, 40, 42, 43, 43, 43, 41, 47, 43].sort(compare));

    t.end();
});

test('reconstructs an index from array buffer', (t) => {
    const index = createIndex();
    const index2 = Flatbush.from(index.data);

    t.same(index, index2);
    t.end();
});

test('throws an error if added less items than the index size', (t) => {
    t.throws(() => {
        const index = new Flatbush(data.length / 4);
        index.finish();
    });
    t.end();
});

test('throws an error if searching before indexing', (t) => {
    t.throws(() => {
        const index = new Flatbush(data.length / 4);
        index.search(0, 0, 20, 20);
    });
    t.end();
});

test('does not freeze on numItems = 0', {timeout: 100}, (t) => {
    t.throws(() => {
        new Flatbush(0); // eslint-disable-line
    });
    t.end();
});

test('performs a k-nearest-neighbors query', (t) => {
    const index = createIndex();
    const ids = index.neighbors(50, 50, 3);
    t.same(ids.sort(compare), [31, 6, 75].sort(compare));
    t.end();
});

test('k-nearest-neighbors query accepts maxDistance', (t) => {
    const index = createIndex();
    const ids = index.neighbors(50, 50, Infinity, 12);
    t.same(ids.sort(compare), [6, 29, 31, 75, 85].sort(compare));
    t.end();
});

test('k-nearest-neighbors query accepts filterFn', (t) => {
    const index = createIndex();
    const ids = index.neighbors(50, 50, 6, Infinity, i => i % 2 === 0);
    t.same(ids.sort(compare), [6, 16, 18, 24, 54, 80].sort(compare));
    t.end();
});

test('returns index of newly-added rectangle', (t) => {
    const count = 5;
    const index = new Flatbush(count);

    const ids = [];
    for (let i = 0; i < count; i++) {
        const id = index.add(data[i], data[i + 1], data[i + 2], data[i + 3]);
        ids.push(id);
    }

    const expectedSequence = Array.from(Array(count), (v, i) => i);
    t.same(ids, expectedSequence);
    t.end();
});

function compare(a, b) { return a - b; }
