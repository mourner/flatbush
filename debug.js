
var flatbush = require('./');

var N = 1000000;
var hilbertOrder = 16;

console.time('gen data');
var coords = [];
var spaceSize = 100;
var boxSize = 1;
for (var i = 0; i < N; i++) {
    var x = Math.random() * (spaceSize - boxSize);
    var y = Math.random() * (spaceSize - boxSize);
    var x2 = x + Math.random() * boxSize;
    var y2 = y + Math.random() * boxSize;
    coords.push(x, y, x2, y2);
}
console.timeEnd('gen data');

console.time('flatbush');
var index = flatbush(N);
for (var i = 0; i < coords.length; i += 4) {
    index.add(
        coords[i],
        coords[i + 1],
        coords[i + 2],
        coords[i + 3]);
}
index.finish();
// console.log(index.data);
console.timeEnd('flatbush');
