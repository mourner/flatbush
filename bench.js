
import Flatbush from './index.js';
import RBush from 'rbush';
import rbushKNN from 'rbush-knn';

const N = 1000000;
const K = 1000;
const nodeSize = 16;

console.log(`${N} rectangles`);
console.log(`node size: ${nodeSize}`);
console.log('');

function addRandomBox(arr, boxSize) {
    const x = Math.random() * (100 - boxSize);
    const y = Math.random() * (100 - boxSize);
    const x2 = x + Math.random() * boxSize;
    const y2 = y + Math.random() * boxSize;
    arr.push(x, y, x2, y2);
}

const coords = [];
for (let i = 0; i < N; i++) addRandomBox(coords, 1);

const boxes100 = [];
const boxes10 = [];
const boxes1 = [];
for (let i = 0; i < K; i++) {
    addRandomBox(boxes100, 100 * Math.sqrt(0.1));
    addRandomBox(boxes10, 10);
    addRandomBox(boxes1, 1);
}

console.time('flatbush');
const index = new Flatbush(N, nodeSize);
for (let i = 0; i < coords.length; i += 4) {
    index.add(
        coords[i],
        coords[i + 1],
        coords[i + 2],
        coords[i + 3]);
}
index.finish();
console.timeEnd('flatbush');

console.log(`index size: ${index.data.byteLength.toLocaleString()}`);

function benchSearch(boxes, name, warmup) {
    const id = `${K} searches ${name}`;
    if (!warmup) console.time(id);
    for (let i = 0; i < boxes.length; i += 4) {
        index.search(boxes[i], boxes[i + 1], boxes[i + 2], boxes[i + 3]);
    }
    if (!warmup) console.timeEnd(id);
}

function benchNeighbors(K, M, warmup) {
    const id = `${K} searches of ${M} neighbors`;
    if (!warmup) console.time(id);
    for (let i = 0; i < K; i++) {
        index.neighbors(coords[4 * i], coords[4 * i + 1], M);
    }
    if (!warmup) console.timeEnd(id);
}

benchSearch(boxes1, '0.01%', true);
benchSearch(boxes100, '10%');
benchSearch(boxes10, '1%');
benchSearch(boxes1, '0.01%');

benchNeighbors(K, 1, true);
benchNeighbors(K, 100);
benchNeighbors(1, N);
benchNeighbors(N / 10, 1);

const dataForRbush = [];
for (let i = 0; i < coords.length; i += 4) {
    dataForRbush.push({
        minX: coords[i],
        minY: coords[i + 1],
        maxX: coords[i + 2],
        maxY: coords[i + 3]
    });
}

console.log('');
console.time('rbush');
const rbushIndex = new RBush(nodeSize).load(dataForRbush);
console.timeEnd('rbush');

function benchSearchRBush(boxes, name, warmup) {
    const boxes2 = [];
    for (let i = 0; i < boxes.length; i += 4) {
        boxes2.push({
            minX: boxes[i],
            minY: boxes[i + 1],
            maxX: boxes[i + 2],
            maxY: boxes[i + 3]
        });
    }
    const id = `${K} searches ${name}`;
    if (!warmup) console.time(id);
    for (let i = 0; i < boxes2.length; i++) {
        rbushIndex.search(boxes2[i]);
    }
    if (!warmup) console.timeEnd(id);
}

function benchNeighborsRBush(K, M, warmup) {
    const id = `${K} searches of ${M} neighbors`;
    if (!warmup) console.time(id);
    for (let i = 0; i < K; i++) {
        rbushKNN(rbushIndex, coords[4 * i], coords[4 * i + 1], M);
    }
    if (!warmup) console.timeEnd(id);
}

benchSearchRBush(boxes1, '0.01%', true);
benchSearchRBush(boxes100, '10%');
benchSearchRBush(boxes10, '1%');
benchSearchRBush(boxes1, '0.01%');

benchNeighborsRBush(K, 1, true);
benchNeighborsRBush(K, 100);
benchNeighborsRBush(1, N);
benchNeighborsRBush(N / 10, 1);
