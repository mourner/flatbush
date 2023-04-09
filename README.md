# Flatbush

A really fast **static spatial index** for 2D points and rectangles in JavaScript.

An efficient implementation of the [packed Hilbert R-tree](https://en.wikipedia.org/wiki/Hilbert_R-tree#Packed_Hilbert_R-trees) algorithm. Enables fast spatial queries on a very large number of objects (e.g. millions), which is very useful in maps, data visualizations and computational geometry algorithms.

Similar to [RBush](https://github.com/mourner/rbush), with the following key differences:

- **Static**: you can't add/remove items after initial indexing.
- **Faster** indexing and search, with much lower **memory** footprint.
- Index is stored as a single **array buffer** (so you can [transfer](https://developer.mozilla.org/en-US/docs/Glossary/Transferable_objects) it between threads or store it as a compact binary file).

Supports geographic locations with the [geoflatbush](https://github.com/mourner/geoflatbush) extension.

[![Build Status](https://github.com/mourner/flatbush/workflows/Node/badge.svg?branch=master)](https://github.com/mourner/flatbush/actions)
[![minzipped size](https://badgen.net/bundlephobia/minzip/flatbush)](https://esm.run/flatbush)
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

// make a k-nearest-neighbors query
const neighborIds = index.neighbors(x, y, 5);

// instantly transfer the index from a worker to the main thread
postMessage(index.data, [index.data]);

// reconstruct the index from a raw array buffer
const index = Flatbush.from(e.data);

```

## Install

Install with NPM: `npm install flatbush`, then import as a module:

```js
import Flatbush from 'flatbush';
```

Or use as a module directly in the browser with [jsDelivr](https://www.jsdelivr.com/esm):

```html
<script type="module">
    import Flatbush from 'https://cdn.jsdelivr.net/npm/flatbush/+esm';
</script>
```

Alternatively, there's a browser bundle with a `Flatbush` global variable:

```html
<script src="https://cdn.jsdelivr.net/npm/flatbush"></script>
```

## API

#### `new Flatbush(numItems[, nodeSize, ArrayType, ArrayBufferType])`

Creates a Flatbush index that will hold a given number of items (`numItems`). Additionally accepts:

- `nodeSize`: size of the tree node (`16` by default); experiment with different values for best performance (increasing this value makes indexing faster and queries slower, and vise versa).
- `ArrayType`: the array type used for coordinates storage (`Float64Array` by default);
other types may be faster in certain cases (e.g. `Int32Array` when your data is integer).
- `ArrayBufferType`: the array buffer type used to store data (`ArrayBuffer` by default);
you may prefer `SharedArrayBuffer` if you want to share the index between threads (multiple `Worker`, `SharedWorker` or `ServiceWorker`).

#### `index.add(minX, minY, maxX, maxY)`

Adds a given rectangle to the index. Returns a zero-based, incremental number that represents the newly added rectangle.

#### `index.finish()`

Performs indexing of the added rectangles.
Their number must match the one provided when creating a `Flatbush` object.

#### `index.search(minX, minY, maxX, maxY[, filterFn])`

Returns an array of indices of items intersecting or touching a given bounding box. Item indices refer to the value returned by [`index.add()`](#indexaddminx-miny-maxx-maxy).

```js
const ids = index.search(10, 10, 20, 20);
```

If given a `filterFn`, calls it on every found item (passing an item index)
and only includes it if the function returned a truthy value.

```js
const ids = index.search(10, 10, 20, 20, (i) => items[i].foo === 'bar');
```

#### `index.neighbors(x, y[, maxResults, maxDistance, filterFn])`

Returns an array of item indices in order of distance from the given `x, y`
(known as K nearest neighbors, or KNN). Item indices refer to the value returned by [`index.add()`](#indexaddminx-miny-maxx-maxy).

```js
const ids = index.neighbors(10, 10, 5); // returns 5 ids
```

`maxResults` and `maxDistance` are `Infinity` by default.
Also accepts a `filterFn` similar to `index.search`.

#### `Flatbush.from(data)`

Recreates a Flatbush index from raw `ArrayBuffer` or `SharedArrayBuffer` data
(that's exposed as `index.data` on a previously indexed Flatbush instance).
Very useful for transferring or sharing indices between threads or storing them in a file.

### Properties

- `data`: array buffer that holds the index.
- `minX`, `minY`, `maxX`, `maxY`: bounding box of the data.
- `numItems`: number of stored items.
- `nodeSize`: number of items in a node tree.
- `ArrayType`: array type used for internal coordinates storage.
- `IndexArrayType`: array type used for internal item indices storage.

## Performance

Running `node bench.js` with Node v14:

bench | flatbush | rbush
--- | --- | ---
index 1,000,000 rectangles | 273ms | 1143ms
1000 searches 10% | 575ms | 781ms
1000 searches 1% | 63ms | 155ms
1000 searches 0.01% | 6ms | 17ms
1000 searches of 100 neighbors | 24ms | 43ms
1 search of 1,000,000 neighbors | 133ms | 280ms
100,000 searches of 1 neighbor | 710ms | 1170ms

## Ports

- [jbuckmccready/static_aabb2d_index](https://github.com/jbuckmccready/static_aabb2d_index) (Rust port)
- [jbuckmccready/Flatbush](https://github.com/jbuckmccready/Flatbush) (C# port)
- [IMQS/flatbush](https://github.com/IMQS/flatbush) (C++ port)
- [bmharper/flatbush-python](https://github.com/bmharper/flatbush-python) (Python port)
- [FlatGeobuf](https://github.com/flatgeobuf/flatgeobuf) (a geospatial format inspired by Flatbush)
