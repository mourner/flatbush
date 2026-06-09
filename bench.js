
import Flatbush from './index.js';

const N = 1000000;
const nodeSize = 16;
const REPS = 10; // repetitions per search benchmark

console.log(`node size: ${nodeSize}; runs: ${REPS}`);

// Seeded PRNG (mulberry32) so data & queries are identical across process runs,
// making before/after comparisons of an optimization meaningful.
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const random = mulberry32(0x9e3779b9);

function addRandomBox(arr, boxSize) {
    const x = random() * (100 - boxSize);
    const y = random() * (100 - boxSize);
    const x2 = x + random() * boxSize;
    const y2 = y + random() * boxSize;
    arr.push(x, y, x2, y2);
}

// generate `count` query boxes each covering a fixed fraction of the 100x100 space
function makeQueryBoxes(area, count) {
    const boxSize = 100 * Math.sqrt(area);
    const boxes = [];
    for (let i = 0; i < count; i++) {
        const x = random() * (100 - boxSize);
        const y = random() * (100 - boxSize);
        boxes.push(x, y, x + boxSize, y + boxSize);
    }
    return boxes;
}

// min + mean±std over an array of timings (ms), padded for column alignment
function stats(times) {
    const n = times.length;
    const min = Math.min(...times);
    const mean = times.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(times.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const minStr = min.toFixed(2).padStart(7);
    const meanStr = mean.toFixed(2).padStart(7);
    return `min ${minStr}ms   mean ${meanStr}±${std.toFixed(2)}ms`;
}

// pad a label to a fixed width so stats() columns line up across runs
function label(text) {
    return `${text}`.padEnd(25);
}

const coords = [];
for (let i = 0; i < N; i++) addRandomBox(coords, 1);

// query sets scaled so each test does comparable total work (count ~ 1/area)
const searchTests = [
    {name: '10%', area: 0.1, count: 100},
    {name: '1%', area: 0.01, count: 1000},
    {name: '0.1%', area: 0.001, count: 10000},
    {name: '0.01%', area: 0.0001, count: 10000},
    {name: '0.001%', area: 0.00001, count: 10000},
];
for (const t of searchTests) t.boxes = makeQueryBoxes(t.area, t.count);

function buildIndex() {
    const index = new Flatbush(N, nodeSize);
    for (let i = 0; i < coords.length; i += 4) {
        index.add(
            coords[i],
            coords[i + 1],
            coords[i + 2],
            coords[i + 3]);
    }
    index.finish();
    return index;
}

const index = buildIndex();
console.log(`index size: ${index.data.byteLength.toLocaleString()} bytes\n`);

function benchIndex() {
    const times = [];
    // warmed up above
    for (let r = 0; r < REPS; r++) {
        const start = performance.now();
        buildIndex();
        times.push(performance.now() - start);
    }
    console.log(`${label(`index ${N} boxes`)} ${stats(times)}`);
}
benchIndex();

// accumulator to prevent dead-code elimination of search results
let sink = 0;

function benchSearch(boxes, name, count) {
    // warmup
    for (let i = 0; i < boxes.length; i += 4) {
        sink += index.search(boxes[i], boxes[i + 1], boxes[i + 2], boxes[i + 3]).length;
    }
    const times = [];
    for (let r = 0; r < REPS; r++) {
        const start = performance.now();
        for (let i = 0; i < boxes.length; i += 4) {
            sink += index.search(boxes[i], boxes[i + 1], boxes[i + 2], boxes[i + 3]).length;
        }
        times.push(performance.now() - start);
    }
    console.log(`${label(`${count} searches ${name}`)} ${stats(times)}`);
}

function benchNeighbors(Ksearch, M) {
    // warmup
    for (let i = 0; i < Ksearch; i++) {
        sink += index.neighbors(coords[4 * i], coords[4 * i + 1], M).length;
    }
    const times = [];
    for (let r = 0; r < REPS; r++) {
        const start = performance.now();
        for (let i = 0; i < Ksearch; i++) {
            sink += index.neighbors(coords[4 * i], coords[4 * i + 1], M).length;
        }
        times.push(performance.now() - start);
    }
    console.log(`${label(`${Ksearch} searches of k-${M}`)} ${stats(times)}`);
}

for (const t of searchTests) benchSearch(t.boxes, t.name, t.count);

benchNeighbors(10000, 1);
benchNeighbors(10000, 100);
benchNeighbors(1, N);

if (sink < 0) console.log(sink); // keep sink observable
