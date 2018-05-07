# Flatbush

A really fast **static spatial index** for 2D points and rectangles in JavaScript.

An efficient implementation of the [packed Hilbert R-tree](https://en.wikipedia.org/wiki/Hilbert_R-tree#Packed_Hilbert_R-trees) algorithm. Enables fast spatial queries on a very large number of objects (e.g. millions), which is very useful in maps, data visualizations and computational geometry algorithms.

Similar to [RBush](https://github.com/mourner/rbush), with the following key differences:

- **Static**: you can't add/remove items after initial indexing.
- **Faster** indexing and search, with much lower **memory** footprint.
- Index is stored as a single **array buffer** (so you can [transfer](https://developer.mozilla.org/en-US/docs/Web/API/Transferable) it between threads or store it as a compact binary file).

[![Build Status](https://travis-ci.org/mourner/flatbush.svg?branch=master)](https://travis-ci.org/mourner/flatbush)
[![gzipped size: 1.8 kB](https://img.shields.io/badge/gzipped%20size-1.8%20kB-brightgreen.svg)](https://unpkg.com/flatbush)
[![Simply Awesome](https://img.shields.io/badge/simply-awesome-brightgreen.svg)](https://github.com/mourner/projects)

## Usage

```js
// initialize Flatbush for 1000 items
const index = new Flatbush(1000);

// fill it with 1000 rectangles
for (const p of items) {
    index.add(p.minX, p.minY, p.maxX, p.maxY);
}

// perform the indexing
index.finish();

// make a bounding box query
const found = index.search(minX, minY, maxX, maxY).map((i) => items[i]);

// instantly transfer the index from a worker to the main thread
postMessage(index.data, [index.data]);

// reconstruct the index from a raw array buffer
const index = Flatbush.from(e.data);

```

## Install

Install using NPM (`npm install flatbush`) or Yarn (`yarn add flatbush`), then:

```js
// import as an ES module
import Flatbush from 'flatbush';

// or require in Node / Browserify
const Flatbush = require('flatbush');
```

Or use a browser build directly:

```html
<script src="https://unpkg.com/flatbush@3.0.0/flatbush.min.js"></script>
```

## API

#### new Flatbush(numItems[, nodeSize, ArrayType, data])

Creates a Flatbush index that will hold a given number of items (`numItems`). Additionally accepts:

- `nodeSize`: size of the tree node (`16` by default); experiment with different values for best performance.
- `ArrayType`: the array type used for tree storage (`Float64Array` by default);
other types may be faster in certain cases (e.g. `Int32Array` when your data is integer).
- `data`: if provided an array or an array buffer from a previously indexed Flatbush object (`index.data` or `index.data.buffer`),
an index will be recreated from this data (useful for transfering indices between threads).

#### index.add(minX, minY, maxX, maxY)

Adds a given rectangle to the index.

#### index.finish()

Performs indexing of the added rectangles.
Their number must match the one provided when creating a `flatbush` object.

#### index.search(minX, minY, maxX, maxY[, filterFn])

Returns an array of indices of items in a given bounding box.

```js
const ids = index.search(10, 10, 20, 20);
```

If given a `filterFn`, calls it on every found item (passing an item index)
and only includes it if the function returned a truthy value.

```js
const ids = index.search(10, 10, 20, 20, (i) => items[i].foo === 'bar');
```

#### Flatbush.from(data)

Recreates a Flatbush index from raw `ArrayBuffer` data
(that's exposed as `index.data` on a previously indexed Flatbush instance).
Very useful for transfering indices between threads or storing them in a file.

#### Properties

- `data`: array buffer that holds the index.
- `minX`, `minY`, `maxX`, `maxY`: bounding box of the data.

## Performance

Running `npm run bench` with Node v8.10.0:

```
1000000 rectangles

flatbush: 252.849ms
1000 searches 10%: 617.473ms
1000 searches 1%: 66.968ms
1000 searches 0.01%: 7.818ms

rbush: 1083.758ms
1000 searches 10%: 920.252ms
1000 searches 1%: 173.104ms
1000 searches 0.01%: 19.057ms
```
