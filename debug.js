'use strict';

var flatbush = require('./');

var N = 1000000;

function addRandomBox(arr, boxSize) {
    var x = Math.random() * (100 - boxSize);
    var y = Math.random() * (100 - boxSize);
    var x2 = x + Math.random() * boxSize;
    var y2 = y + Math.random() * boxSize;
    arr.push(x, y, x2, y2);
}

var coords = [];
for (var i = 0; i < N; i++) addRandomBox(coords, 1);

console.time('flatbush');
var index = flatbush(N, 64);
for (i = 0; i < coords.length; i += 4) {
    index.add(
        coords[i],
        coords[i + 1],
        coords[i + 2],
        coords[i + 3]);
}
index.finish();
// console.log(index.data);
console.timeEnd('flatbush');

var K = 10000;

var boxes100 = [];
var boxes10 = [];
var boxes1 = [];
for (i = 0; i < K; i++) {
    addRandomBox(boxes100, 100 * Math.sqrt(0.1));
    addRandomBox(boxes10, 10);
    addRandomBox(boxes1, 1);
}

var results = [];

function empty(i) {
    results.push(i);
}

console.time(K + ' searches 10%');
for (i = 0; i < boxes100.length; i += 4) {
    results = [];
    index.search(boxes100[i], boxes100[i + 1], boxes100[i + 2], boxes100[i + 3], empty);
}
console.timeEnd(K + ' searches 10%');

console.time(K + ' searches 1%');
for (i = 0; i < boxes10.length; i += 4) {
    results = [];
    index.search(boxes10[i], boxes10[i + 1], boxes10[i + 2], boxes10[i + 3], empty);
}
console.timeEnd(K + ' searches 1%');

console.time(K + ' searches 0.01%');
for (i = 0; i < boxes1.length; i += 4) {
    results = [];
    index.search(boxes1[i], boxes1[i + 1], boxes1[i + 2], boxes1[i + 3], empty);
}
console.timeEnd(K + ' searches 0.01%');
