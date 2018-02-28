'use strict';

var flatbush = require('./');
var rbush = require('rbush');

var N = 1000000;
var K = 1000;

console.log(N + ' rectangles');

function addRandomBox(arr, boxSize) {
    var x = Math.random() * (100 - boxSize);
    var y = Math.random() * (100 - boxSize);
    var x2 = x + Math.random() * boxSize;
    var y2 = y + Math.random() * boxSize;
    arr.push(x, y, x2, y2);
}

var coords = [];
for (var i = 0; i < N; i++) addRandomBox(coords, 1);

var boxes100 = [];
var boxes10 = [];
var boxes1 = [];
for (i = 0; i < K; i++) {
    addRandomBox(boxes100, 100 * Math.sqrt(0.1));
    addRandomBox(boxes10, 10);
    addRandomBox(boxes1, 1);
}

console.time('flatbush');
var index = flatbush(N, 16);
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

function benchSearch(boxes, name) {
    var id = K + ' searches ' + name;
    console.time(id);
    for (i = 0; i < boxes.length; i += 4) {
        index.search(boxes[i], boxes[i + 1], boxes[i + 2], boxes[i + 3]);
    }
    console.timeEnd(id);
}

benchSearch(boxes100, '10%');
benchSearch(boxes10, '1%');
benchSearch(boxes1, '0.01%');

var dataForRbush = [];
for (i = 0; i < coords.length; i += 4) {
    dataForRbush.push({
        minX: coords[i],
        minY: coords[i + 1],
        maxX: coords[i + 2],
        maxY: coords[i + 3]
    });
}

console.time('rbush');
var rbushIndex = rbush().load(dataForRbush);
console.timeEnd('rbush');

function benchSearchRBush(boxes, name) {
    var boxes2 = [];
    for (var i = 0; i < boxes.length; i += 4) {
        boxes2.push({
            minX: boxes[i],
            minY: boxes[i + 1],
            maxX: boxes[i + 2],
            maxY: boxes[i + 3]
        });
    }
    var id = K + ' searches ' + name;
    console.time(id);
    for (i = 0; i < boxes2.length; i++) {
        rbushIndex.search(boxes2[i]);
    }
    console.timeEnd(id);
}

benchSearchRBush(boxes100, '10%');
benchSearchRBush(boxes10, '1%');
benchSearchRBush(boxes1, '0.01%');
