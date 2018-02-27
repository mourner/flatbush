# flatbush

A really fast static spatial index for 2D rectangles. Similar to [rbush](https://github.com/mourner/rbush), with the following differences:

- Static: you can't add/remove items.
- Much faster indexing, with lower memory footprint.
- Index is stored as a flat typed array (which can be [transfered](https://developer.mozilla.org/en-US/docs/Web/API/Transferable)).

## Example

```js
const index = flatbush(1000); // initialize flatbush for 1000 items

for (const p of itemsToIndex) {
    index.add(p.minX, p.minY, p.maxX, p.maxY); // add 1000 rectangles one by one
}
index.finish(); // magic

// make a bounding box query, providing a visitor function
index.search(minX, minY, maxX, maxY, (i) => {
    console.log(`found ${itemsToIndex[i]}`);
});

```

## Performance

Running `node bench.js`:

```
1000000 rectangles

flatbush: 310.386ms
1000 searches 10%: 818.892ms
1000 searches 1%: 155.498ms
1000 searches 0.01%: 14.835ms

rbush: 1372.663ms
1000 searches 10%: 1451.644ms
1000 searches 1%: 233.894ms
1000 searches 0.01%: 23.553ms
```
