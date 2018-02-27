# flatbush

_Work in progress._

A really fast static spatial index for 2D rectangles. Similar to [rbush](https://github.com/mourner/rbush), with the following differences:

- Static (you can't add/remove items).
- Much faster indexing when used on a large amount of items.
- Index is stored as a flat typed array (which can be [transfered](https://developer.mozilla.org/en-US/docs/Web/API/Transferable)).
