# flatbush

A really fast static **spatial index** for 2D points and rectangles in JavaScript.
An efficient implementation of the [packed Hilbert R-tree](https://en.wikipedia.org/wiki/Hilbert_R-tree#Packed_Hilbert_R-trees) algorithm.

Enables near-instant spatial queries on a very large number of objects (e.g. millions),
which is very useful in maps, data visualizations and computational geometry algorithms.

Similar to [RBush](https://github.com/mourner/rbush), with the following differences:

- Static: you can't add/remove items after initial indexing.
- Faster indexing and search, with lower memory footprint.
- Index is stored as a single flat typed array (which can be [transfered](https://developer.mozilla.org/en-US/docs/Web/API/Transferable)).

[![Build Status](https://travis-ci.org/mourner/flatbush.svg?branch=master)](https://travis-ci.org/mourner/flatbush)
[![Simply Awesome](https://img.shields.io/badge/simply-awesome-brightgreen.svg)](https://github.com/mourner/projects)

## Example

```js
// initialize flatbush for 1000 items
const index = flatbush(1000);

// fill it with 1000 rectangles
for (const p of itemsToIndex) {
    index.add(p.minX, p.minY, p.maxX, p.maxY);
}

// perform the indexing
index.finish();

// make a bounding box query
index.search(minX, minY, maxX, maxY, (i) => {
    console.log(`found ${itemsToIndex[i]}`);
});

```

## API

#### flatbush(numItems)

Creates a `flatbush` index for storing a given number of items (`numItems`).

#### index.add(minX, minY, maxX, maxY)

Adds a given rectangle to the index.

#### index.finish()

Performs indexing of the added rectangles.
Their number most match the one provided when creating a `flatbush` object.

#### index.search(minX, minY, maxX, maxY, visitorFn)

Calls `visitorFn(i)` on every item that intersects a given rectangular query,
where `i` is the index of the item according to the order it was added.

## Performance

Running `node bench.js`:

```
1000000 rectangles

flatbush: 299.147ms
1000 searches 10%: 784.722ms
1000 searches 1%: 113.550ms
1000 searches 0.01%: 15.212ms

rbush: 1169.129ms
1000 searches 10%: 957.165ms
1000 searches 1%: 188.941ms
1000 searches 0.01%: 18.105ms
```
