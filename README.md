# flatbush

A really fast **static spatial index** for 2D points and rectangles in JavaScript.

An efficient implementation of the [packed Hilbert R-tree](https://en.wikipedia.org/wiki/Hilbert_R-tree#Packed_Hilbert_R-trees) algorithm. Enables fast spatial queries on a very large number of objects (e.g. millions), which is very useful in maps, data visualizations and computational geometry algorithms.

Similar to [RBush](https://github.com/mourner/rbush), with the following key differences:

- **Static**: you can't add/remove items after initial indexing.
- **Faster** indexing and search, with much lower **memory** footprint.
- Index is stored as a single **typed array** (which can be [transfered](https://developer.mozilla.org/en-US/docs/Web/API/Transferable)).

[![Build Status](https://travis-ci.org/mourner/flatbush.svg?branch=master)](https://travis-ci.org/mourner/flatbush)
[![Simply Awesome](https://img.shields.io/badge/simply-awesome-brightgreen.svg)](https://github.com/mourner/projects)

## Example

```js
// initialize flatbush for 1000 items
const index = flatbush(1000);

// fill it with 1000 rectangles
for (const p of items) {
    index.add(p.minX, p.minY, p.maxX, p.maxY);
}

// perform the indexing
index.finish();

// make a bounding box query
var found = index.search(minX, minY, maxX, maxY).map((i) => items[i]);

```

## Install

Install using NPM (`npm install flatbush`) or Yarn (`yarn add flatbush`), then either:

```js
// require in Node / Browserify
var flatbush = require('flatbush');

// or import as a ES module
import flatbush from 'flatbush';
```

Or use a browser build directly:

```html
<script src="https://unpkg.com/flatbush@1.3.0/flatbush.min.js"></script>
```

## API

#### flatbush(numItems[, nodeSize, ArrayType])

Creates a `flatbush` index that will hold a given number of items (`numItems`). Additionally accepts:

- `nodeSize`: size of the tree node (16 by default); experiment with different values for best performance.
- `ArrayType`: the array type used for tree storage (`Float64Array` by default);
other types may be faster in certain cases (e.g. `Int32Array` when your data is integer)

#### index.add(minX, minY, maxX, maxY)

Adds a given rectangle to the index.

#### index.finish()

Performs indexing of the added rectangles.
Their number must match the one provided when creating a `flatbush` object.

#### index.search(minX, minY, maxX, maxY[, filterFn])

Returns an array of indices of items in a given bounding box.

```js
var ids = index.search(10, 10, 20, 20);
```

If given a `filterFn`, calls it on every found item (passing an item index)
and only includes it if the function returned a truthy value.

```js
var ids = index.search(10, 10, 20, 20, (i) => items[i].foo === 'bar');
```

## Performance

Running `npm run bench`:

```
1000000 rectangles

flatbush: 268.348ms
10000 searches 10%: 7156.947ms
10000 searches 1%: 809.680ms
10000 searches 0.01%: 90.744ms

rbush: 1298.968ms
10000 searches 10%: 10559.077ms
10000 searches 1%: 1583.737ms
10000 searches 0.01%: 191.569ms
```
